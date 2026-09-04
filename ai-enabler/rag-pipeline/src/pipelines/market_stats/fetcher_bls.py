"""
BLS API v2 Fetcher
==================
Fetches JOLTS, CES, and CPS series for the market_stats pipeline.

API:     https://api.bls.gov/publicAPI/v2/timeseries/data/
Auth:    API key in header (BLS_API_KEY env var). Without key: 25 series/req, 500/day.
         With key: 25 series/req, 500/day (key mainly removes IP throttle).
No key needed for dev — just slower rate limits.

Series ID format:
  JOLTS:  JTU + [supersector_code] + [size_class] + [data_element] + [seasonal]
          JTU = JOLTS Unadjusted prefix  |  JTS = JOLTS Seasonally adjusted
  CES:    CES + [supersector_code] + [data_type_code]
  CPS:    LNU + [measure_code] + [demographic_code]

Outputs: list of normalized dicts ready for transformer.py
"""

import os
import json
import logging
import requests
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

# This module reads BLS_API_KEY at import time (module-level constant below),
# and runner.py imports this module before it imports config.settings (whose
# load_dotenv() call the key was silently depending on) — so without this
# call, BLS_API_KEY is always "" regardless of what's in .env, no matter what
# key is configured. load_dotenv() is idempotent/safe to call more than once.
load_dotenv()

logger = logging.getLogger(__name__)

BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
BLS_API_KEY = os.getenv("BLS_API_KEY", "")  # Optional — works without key

# ---------------------------------------------------------------------------
# Series registry
# Each entry: (series_id, label, signal_type, industry, naics, cadence)
# ---------------------------------------------------------------------------

# JOLTS series — seasonally adjusted rates (SA suffix = S, not SA = U)
# Format: JTS + [industry_code 8 digits] + [size 2] + [element 2] + [SA: S or U]
# Industry code 000000000 = total nonfarm
# Size class 00 = all sizes
# Elements: JO=openings, HI=hires, TS=total sep, QU=quits, LD=layoffs/discharges

JOLTS_SERIES = [
    # Total nonfarm
    # Confirmed format: JTS + industry(6) + state(2) + sizeclass(2) + element(2) + ratelevel(1)
    # Total nonfarm = 000000, All areas = 00, All sizes = 00
    ("JTS000000000000000LDR", "Total nonfarm - layoffs rate",          "contraction_indicator", "Total Nonfarm", "00", "monthly"),
    ("JTS000000000000000JOR", "Total nonfarm - job openings rate",     "vacancy_rate",          "Total Nonfarm", "00", "monthly"),
    ("JTS000000000000000QUR", "Total nonfarm - quits rate",            "worker_confidence",     "Total Nonfarm", "00", "monthly"),
    ("JTS000000000000000HIR", "Total nonfarm - hires rate",            "hiring_rate",           "Total Nonfarm", "00", "monthly"),
    # Information (NAICS 51) — tech proxy
    ("JTS510000000000000LDR", "Information - layoffs rate",            "contraction_indicator", "Information",   "51", "monthly"),
    ("JTS510000000000000JOR", "Information - job openings rate",       "vacancy_rate",          "Information",   "51", "monthly"),
    ("JTS510000000000000QUR", "Information - quits rate",              "worker_confidence",     "Information",   "51", "monthly"),
    # Professional and Business Services (NAICS 54-56)
    # JOLTS uses supersector code 540099 for Professional and Business Services
    ("JTS540099000000000LDR", "Prof & Business Svcs - layoffs rate",   "contraction_indicator", "Professional and Business Services", "54", "monthly"),
    ("JTS540099000000000JOR", "Prof & Business Svcs - openings rate",  "vacancy_rate",          "Professional and Business Services", "54", "monthly"),
    ("JTS540099000000000QUR", "Prof & Business Svcs - quits rate",     "worker_confidence",     "Professional and Business Services", "54", "monthly"),
    # Finance and Insurance (NAICS 52)
    ("JTS520000000000000LDR", "Finance - layoffs rate",                "contraction_indicator", "Finance and Insurance",             "52", "monthly"),
    ("JTS520000000000000JOR", "Finance - job openings rate",           "vacancy_rate",          "Finance and Insurance",             "52", "monthly"),
    # Health Care and Social Assistance (NAICS 62)
    ("JTS620000000000000LDR", "Health Care - layoffs rate",            "contraction_indicator", "Health Care and Social Assistance", "62", "monthly"),
    ("JTS620000000000000JOR", "Health Care - job openings rate",       "vacancy_rate",          "Health Care and Social Assistance", "62", "monthly"),
    # Manufacturing (NAICS 31-33) — JOLTS uses 300000 for manufacturing supersector
    ("JTS300000000000000LDR", "Manufacturing - layoffs rate",          "contraction_indicator", "Manufacturing", "31", "monthly"),
    ("JTS300000000000000JOR", "Manufacturing - job openings rate",     "vacancy_rate",          "Manufacturing", "31", "monthly"),
    # Construction (NAICS 23)
    ("JTS230000000000000LDR", "Construction - layoffs rate",           "contraction_indicator", "Construction",  "23", "monthly"),
    # Accommodation and Food Services (NAICS 72)
    ("JTS720000000000000LDR", "Accommodation & Food - layoffs rate",   "contraction_indicator", "Accommodation and Food Services", "72", "monthly"),
    ("JTS720000000000000JOR", "Accommodation & Food - openings rate",  "vacancy_rate",          "Accommodation and Food Services", "72", "monthly"),
]

# CES series — seasonally adjusted payroll employment
# Format: CES + [supersector 8 digits] + [data_type 2]
# Data type 01 = all employees (thousands), 11 = avg hourly earnings
CES_SERIES = [
    ("CES0000000001", "Total nonfarm employment",                      "employment_level",  "Total Nonfarm",                     "00", "monthly"),
    ("CES0500000001", "Total private employment",                      "employment_level",  "Total Private",                     "05", "monthly"),
    ("CES0600000001", "Goods-producing employment",                    "employment_level",  "Goods-Producing",                   "06", "monthly"),
    ("CES0700000001", "Service-providing employment",                  "employment_level",  "Service-Providing",                 "07", "monthly"),
    ("CES1000000001", "Mining and logging employment",                 "employment_level",  "Mining and Logging",                "10", "monthly"),
    ("CES2000000001", "Construction employment",                       "employment_level",  "Construction",                     "20", "monthly"),
    ("CES3000000001", "Manufacturing employment",                      "employment_level",  "Manufacturing",                    "30", "monthly"),
    ("CES4000000001", "Trade, trans, utilities employment",            "employment_level",  "Trade Transportation Utilities",    "40", "monthly"),
    ("CES5000000001", "Information employment",                        "employment_level",  "Information",                      "50", "monthly"),
    ("CES5500000001", "Financial activities employment",               "employment_level",  "Financial Activities",             "55", "monthly"),
    ("CES6000000001", "Professional and business services employment", "employment_level",  "Professional and Business Services","60", "monthly"),
    ("CES6500000001", "Education and health services employment",      "employment_level",  "Education and Health Services",    "65", "monthly"),
    ("CES7000000001", "Leisure and hospitality employment",            "employment_level",  "Leisure and Hospitality",          "70", "monthly"),
    ("CES8000000001", "Other services employment",                     "employment_level",  "Other Services",                   "80", "monthly"),
    ("CES9000000001", "Government employment",                         "employment_level",  "Government",                       "90", "monthly"),
    # Avg hourly earnings — key wage signal
    ("CES0500000011", "Private sector avg hourly earnings",            "wage_level",        "Total Private",                    "05", "monthly"),
    ("CES6000000011", "Professional and business svcs avg hourly earnings", "wage_level",   "Professional and Business Services","60", "monthly"),
    ("CES5000000011", "Information avg hourly earnings",               "wage_level",        "Information",                      "50", "monthly"),
]

# CPS series — unemployment by occupation and education
# LNU = Labor force statistics, seasonally adjusted
# These are the national occupation-level unemployment rates from CPS
# VERIFY: CPS occupation series IDs — BLS publishes these but they are less
# standardized than JOLTS/CES. The LNUxx series below are standard SA rates.
CPS_SERIES = [
    # Overall unemployment rates
    ("LNS14000000",  "Overall unemployment rate (U-3)",               "unemployment_rate", "All Occupations",       "all", "monthly"),
    ("LNS13327709",  "U-6 total underemployment rate",                "unemployment_rate", "All Occupations",       "all", "monthly"),
    # Unemployment by education (strong career demand signal)
    ("LNS14027659",  "Unemployment - less than HS diploma",           "unemployment_rate", "Less than HS",          "edu", "monthly"),
    ("LNS14027660",  "Unemployment - HS graduates no college",        "unemployment_rate", "HS Graduate",           "edu", "monthly"),
    ("LNS14027689",  "Unemployment - some college or assoc degree",   "unemployment_rate", "Some College",          "edu", "monthly"),
    ("LNS14027662",  "Unemployment - bachelor degree and higher",     "unemployment_rate", "Bachelor's+",           "edu", "monthly"),
    # Unemployment by occupation major group
    # VERIFY: These SOC-based series — confirm at data.bls.gov/cgi-bin/surveymost?ln
    ("LNU04032215",  "Unemployment - management and professional",    "unemployment_rate", "Management Professional","occ", "monthly"),
    ("LNU04032218",  "Unemployment - service occupations",            "unemployment_rate", "Service Occupations",   "occ", "monthly"),
    ("LNU04032219",  "Unemployment - sales and office",               "unemployment_rate", "Sales and Office",      "occ", "monthly"),
    ("LNU04032222",  "Unemployment - natural resources construction", "unemployment_rate", "Natural Resources",     "occ", "monthly"),
    ("LNU04032226",  "Unemployment - production transport",           "unemployment_rate", "Production Transport",  "occ", "monthly"),
    # National unemployment rate, NOT seasonally adjusted — the correct comparator
    # for METRO_LAUS_SERIES below, which is also NSA (BLS does not seasonally
    # adjust metro-area LAUS estimates). LNS14000000 above is SA and would be a
    # methodological mismatch if paired against metro-area trend series.
    ("LNU04000000",  "US national unemployment rate (NSA, metro-comparable)", "unemployment_rate", "All Industries", "all", "monthly"),
]

# ---------------------------------------------------------------------------
# LAUS series — state unemployment rates + employment levels, seasonally adj
# Format: LASST + {state_fips_2} + 0000000000000 + {measure}
# Measure: 03 = unemployment rate, 06 = employed, 07 = labor force
# Prefix LASST = seasonally adjusted state total
# All 50 states + DC
# ---------------------------------------------------------------------------
LAUS_SERIES = [
    ("LASST010000000000003", "Alabama unemployment rate",        "unemployment_rate", "All Industries", "all", "Alabama",              "state", "monthly"),
    ("LASST020000000000003", "Alaska unemployment rate",         "unemployment_rate", "All Industries", "all", "Alaska",               "state", "monthly"),
    ("LASST040000000000003", "Arizona unemployment rate",        "unemployment_rate", "All Industries", "all", "Arizona",              "state", "monthly"),
    ("LASST050000000000003", "Arkansas unemployment rate",       "unemployment_rate", "All Industries", "all", "Arkansas",             "state", "monthly"),
    ("LASST060000000000003", "California unemployment rate",     "unemployment_rate", "All Industries", "all", "California",           "state", "monthly"),
    ("LASST080000000000003", "Colorado unemployment rate",       "unemployment_rate", "All Industries", "all", "Colorado",             "state", "monthly"),
    ("LASST090000000000003", "Connecticut unemployment rate",    "unemployment_rate", "All Industries", "all", "Connecticut",          "state", "monthly"),
    ("LASST100000000000003", "Delaware unemployment rate",       "unemployment_rate", "All Industries", "all", "Delaware",             "state", "monthly"),
    ("LASST110000000000003", "Washington DC unemployment rate",  "unemployment_rate", "All Industries", "all", "Washington DC",        "state", "monthly"),
    ("LASST120000000000003", "Florida unemployment rate",        "unemployment_rate", "All Industries", "all", "Florida",              "state", "monthly"),
    ("LASST130000000000003", "Georgia unemployment rate",        "unemployment_rate", "All Industries", "all", "Georgia",              "state", "monthly"),
    ("LASST150000000000003", "Hawaii unemployment rate",         "unemployment_rate", "All Industries", "all", "Hawaii",               "state", "monthly"),
    ("LASST160000000000003", "Idaho unemployment rate",          "unemployment_rate", "All Industries", "all", "Idaho",                "state", "monthly"),
    ("LASST170000000000003", "Illinois unemployment rate",       "unemployment_rate", "All Industries", "all", "Illinois",             "state", "monthly"),
    ("LASST180000000000003", "Indiana unemployment rate",        "unemployment_rate", "All Industries", "all", "Indiana",              "state", "monthly"),
    ("LASST190000000000003", "Iowa unemployment rate",           "unemployment_rate", "All Industries", "all", "Iowa",                 "state", "monthly"),
    ("LASST200000000000003", "Kansas unemployment rate",         "unemployment_rate", "All Industries", "all", "Kansas",               "state", "monthly"),
    ("LASST210000000000003", "Kentucky unemployment rate",       "unemployment_rate", "All Industries", "all", "Kentucky",             "state", "monthly"),
    ("LASST220000000000003", "Louisiana unemployment rate",      "unemployment_rate", "All Industries", "all", "Louisiana",            "state", "monthly"),
    ("LASST230000000000003", "Maine unemployment rate",          "unemployment_rate", "All Industries", "all", "Maine",                "state", "monthly"),
    ("LASST240000000000003", "Maryland unemployment rate",       "unemployment_rate", "All Industries", "all", "Maryland",             "state", "monthly"),
    ("LASST250000000000003", "Massachusetts unemployment rate",  "unemployment_rate", "All Industries", "all", "Massachusetts",        "state", "monthly"),
    ("LASST260000000000003", "Michigan unemployment rate",       "unemployment_rate", "All Industries", "all", "Michigan",             "state", "monthly"),
    ("LASST270000000000003", "Minnesota unemployment rate",      "unemployment_rate", "All Industries", "all", "Minnesota",            "state", "monthly"),
    ("LASST280000000000003", "Mississippi unemployment rate",    "unemployment_rate", "All Industries", "all", "Mississippi",          "state", "monthly"),
    ("LASST290000000000003", "Missouri unemployment rate",       "unemployment_rate", "All Industries", "all", "Missouri",             "state", "monthly"),
    ("LASST300000000000003", "Montana unemployment rate",        "unemployment_rate", "All Industries", "all", "Montana",              "state", "monthly"),
    ("LASST310000000000003", "Nebraska unemployment rate",       "unemployment_rate", "All Industries", "all", "Nebraska",             "state", "monthly"),
    ("LASST320000000000003", "Nevada unemployment rate",         "unemployment_rate", "All Industries", "all", "Nevada",               "state", "monthly"),
    ("LASST330000000000003", "New Hampshire unemployment rate",  "unemployment_rate", "All Industries", "all", "New Hampshire",        "state", "monthly"),
    ("LASST340000000000003", "New Jersey unemployment rate",     "unemployment_rate", "All Industries", "all", "New Jersey",           "state", "monthly"),
    ("LASST350000000000003", "New Mexico unemployment rate",     "unemployment_rate", "All Industries", "all", "New Mexico",           "state", "monthly"),
    ("LASST360000000000003", "New York unemployment rate",       "unemployment_rate", "All Industries", "all", "New York",             "state", "monthly"),
    ("LASST370000000000003", "North Carolina unemployment rate", "unemployment_rate", "All Industries", "all", "North Carolina",       "state", "monthly"),
    ("LASST380000000000003", "North Dakota unemployment rate",   "unemployment_rate", "All Industries", "all", "North Dakota",         "state", "monthly"),
    ("LASST390000000000003", "Ohio unemployment rate",           "unemployment_rate", "All Industries", "all", "Ohio",                 "state", "monthly"),
    ("LASST400000000000003", "Oklahoma unemployment rate",       "unemployment_rate", "All Industries", "all", "Oklahoma",             "state", "monthly"),
    ("LASST410000000000003", "Oregon unemployment rate",         "unemployment_rate", "All Industries", "all", "Oregon",               "state", "monthly"),
    ("LASST420000000000003", "Pennsylvania unemployment rate",   "unemployment_rate", "All Industries", "all", "Pennsylvania",         "state", "monthly"),
    ("LASST440000000000003", "Rhode Island unemployment rate",   "unemployment_rate", "All Industries", "all", "Rhode Island",         "state", "monthly"),
    ("LASST450000000000003", "South Carolina unemployment rate", "unemployment_rate", "All Industries", "all", "South Carolina",       "state", "monthly"),
    ("LASST460000000000003", "South Dakota unemployment rate",   "unemployment_rate", "All Industries", "all", "South Dakota",         "state", "monthly"),
    ("LASST470000000000003", "Tennessee unemployment rate",      "unemployment_rate", "All Industries", "all", "Tennessee",            "state", "monthly"),
    ("LASST480000000000003", "Texas unemployment rate",          "unemployment_rate", "All Industries", "all", "Texas",                "state", "monthly"),
    ("LASST490000000000003", "Utah unemployment rate",           "unemployment_rate", "All Industries", "all", "Utah",                 "state", "monthly"),
    ("LASST500000000000003", "Vermont unemployment rate",        "unemployment_rate", "All Industries", "all", "Vermont",              "state", "monthly"),
    ("LASST510000000000003", "Virginia unemployment rate",       "unemployment_rate", "All Industries", "all", "Virginia",             "state", "monthly"),
    ("LASST530000000000003", "Washington unemployment rate",     "unemployment_rate", "All Industries", "all", "Washington",           "state", "monthly"),
    ("LASST540000000000003", "West Virginia unemployment rate",  "unemployment_rate", "All Industries", "all", "West Virginia",        "state", "monthly"),
    ("LASST550000000000003", "Wisconsin unemployment rate",      "unemployment_rate", "All Industries", "all", "Wisconsin",            "state", "monthly"),
    ("LASST560000000000003", "Wyoming unemployment rate",        "unemployment_rate", "All Industries", "all", "Wyoming",              "state", "monthly"),
]

# ---------------------------------------------------------------------------
# Metro-area LAUS unemployment rates for the US cities in the client's
# LOCATION_OPTIONS list (client/consts/index.ts). NOT seasonally adjusted —
# BLS does not publish SA estimates at metro grain, so compare year-over-year,
# not month-over-month (see LNU04000000 above for the matching national rate).
# Area codes verified live against https://download.bls.gov/pub/time.series/la/la.area
# and the BLS API directly (2 of the initially-derived codes for LA/SF were
# wrong and corrected after the API returned "series does not exist").
# Format: LAU + MT{state_fips_2}{cbsa_5}000000 + {measure}; measure 03 = rate.
# ---------------------------------------------------------------------------
METRO_LAUS_SERIES = [
    ("LAUMT363562000000003", "New York metro unemployment rate",      "unemployment_rate", "All Industries", "all", "New York",     "metro", "monthly"),
    ("LAUMT064186000000003", "San Francisco Bay Area unemployment rate","unemployment_rate", "All Industries", "all", "San Francisco Bay Area", "metro", "monthly"),
    ("LAUMT063108000000003", "Los Angeles metro unemployment rate",    "unemployment_rate", "All Industries", "all", "Los Angeles",  "metro", "monthly"),
    ("LAUMT171698000000003", "Chicago metro unemployment rate",        "unemployment_rate", "All Industries", "all", "Chicago",      "metro", "monthly"),
    ("LAUMT251446000000003", "Boston metro unemployment rate",         "unemployment_rate", "All Industries", "all", "Boston",       "metro", "monthly"),
    ("LAUMT534266000000003", "Seattle metro unemployment rate",        "unemployment_rate", "All Industries", "all", "Seattle",      "metro", "monthly"),
    ("LAUMT481242000000003", "Austin metro unemployment rate",         "unemployment_rate", "All Industries", "all", "Austin",       "metro", "monthly"),
    ("LAUMT481910000000003", "Dallas-Fort Worth metro unemployment rate","unemployment_rate", "All Industries", "all", "Dallas–Fort Worth", "metro", "monthly"),
    ("LAUMT131206000000003", "Atlanta metro unemployment rate",        "unemployment_rate", "All Industries", "all", "Atlanta",      "metro", "monthly"),
    ("LAUMT114790000000003", "Washington DC metro unemployment rate",  "unemployment_rate", "All Industries", "all", "Washington, DC", "metro", "monthly"),
    ("LAUMT123310000000003", "Miami metro unemployment rate",          "unemployment_rate", "All Industries", "all", "Miami",        "metro", "monthly"),
    # Full BLS metro area coverage (393 MSAs) — added below.
    ("LAUMT011150000000003", "Anniston-Oxford unemployment rate", "unemployment_rate", "All Industries", "all", "Anniston-Oxford", "metro", "monthly"),
    ("LAUMT011222000000003", "Auburn-Opelika unemployment rate", "unemployment_rate", "All Industries", "all", "Auburn-Opelika", "metro", "monthly"),
    ("LAUMT011382000000003", "Birmingham unemployment rate", "unemployment_rate", "All Industries", "all", "Birmingham", "metro", "monthly"),
    ("LAUMT011930000000003", "Daphne-Fairhope-Foley unemployment rate", "unemployment_rate", "All Industries", "all", "Daphne-Fairhope-Foley", "metro", "monthly"),
    ("LAUMT011946000000003", "Decatur (AL) unemployment rate", "unemployment_rate", "All Industries", "all", "Decatur (AL)", "metro", "monthly"),
    ("LAUMT012002000000003", "Dothan unemployment rate", "unemployment_rate", "All Industries", "all", "Dothan", "metro", "monthly"),
    ("LAUMT012252000000003", "Florence-Muscle Shoals unemployment rate", "unemployment_rate", "All Industries", "all", "Florence-Muscle Shoals", "metro", "monthly"),
    ("LAUMT012346000000003", "Gadsden unemployment rate", "unemployment_rate", "All Industries", "all", "Gadsden", "metro", "monthly"),
    ("LAUMT012662000000003", "Huntsville unemployment rate", "unemployment_rate", "All Industries", "all", "Huntsville", "metro", "monthly"),
    ("LAUMT013366000000003", "Mobile unemployment rate", "unemployment_rate", "All Industries", "all", "Mobile", "metro", "monthly"),
    ("LAUMT013386000000003", "Montgomery unemployment rate", "unemployment_rate", "All Industries", "all", "Montgomery", "metro", "monthly"),
    ("LAUMT014622000000003", "Tuscaloosa unemployment rate", "unemployment_rate", "All Industries", "all", "Tuscaloosa", "metro", "monthly"),
    ("LAUMT021126000000003", "Anchorage unemployment rate", "unemployment_rate", "All Industries", "all", "Anchorage", "metro", "monthly"),
    ("LAUMT022182000000003", "Fairbanks-College unemployment rate", "unemployment_rate", "All Industries", "all", "Fairbanks-College", "metro", "monthly"),
    ("LAUMT042238000000003", "Flagstaff unemployment rate", "unemployment_rate", "All Industries", "all", "Flagstaff", "metro", "monthly"),
    ("LAUMT042942000000003", "Lake Havasu City-Kingman unemployment rate", "unemployment_rate", "All Industries", "all", "Lake Havasu City-Kingman", "metro", "monthly"),
    ("LAUMT043806000000003", "Phoenix-Mesa-Chandler unemployment rate", "unemployment_rate", "All Industries", "all", "Phoenix-Mesa-Chandler", "metro", "monthly"),
    ("LAUMT043915000000003", "Prescott Valley-Prescott unemployment rate", "unemployment_rate", "All Industries", "all", "Prescott Valley-Prescott", "metro", "monthly"),
    ("LAUMT044342000000003", "Sierra Vista-Douglas unemployment rate", "unemployment_rate", "All Industries", "all", "Sierra Vista-Douglas", "metro", "monthly"),
    ("LAUMT044606000000003", "Tucson unemployment rate", "unemployment_rate", "All Industries", "all", "Tucson", "metro", "monthly"),
    ("LAUMT044974000000003", "Yuma unemployment rate", "unemployment_rate", "All Industries", "all", "Yuma", "metro", "monthly"),
    ("LAUMT052222000000003", "Fayetteville-Springdale-Rogers unemployment rate", "unemployment_rate", "All Industries", "all", "Fayetteville-Springdale-Rogers", "metro", "monthly"),
    ("LAUMT052290000000003", "Fort Smith unemployment rate", "unemployment_rate", "All Industries", "all", "Fort Smith", "metro", "monthly"),
    ("LAUMT052630000000003", "Hot Springs unemployment rate", "unemployment_rate", "All Industries", "all", "Hot Springs", "metro", "monthly"),
    ("LAUMT052786000000003", "Jonesboro unemployment rate", "unemployment_rate", "All Industries", "all", "Jonesboro", "metro", "monthly"),
    ("LAUMT053078000000003", "Little Rock-North Little Rock-Conway unemployment rate", "unemployment_rate", "All Industries", "all", "Little Rock-North Little Rock-Conway", "metro", "monthly"),
    ("LAUMT061254000000003", "Bakersfield-Delano unemployment rate", "unemployment_rate", "All Industries", "all", "Bakersfield-Delano", "metro", "monthly"),
    ("LAUMT061702000000003", "Chico unemployment rate", "unemployment_rate", "All Industries", "all", "Chico", "metro", "monthly"),
    ("LAUMT062094000000003", "El Centro unemployment rate", "unemployment_rate", "All Industries", "all", "El Centro", "metro", "monthly"),
    ("LAUMT062342000000003", "Fresno unemployment rate", "unemployment_rate", "All Industries", "all", "Fresno", "metro", "monthly"),
    ("LAUMT062526000000003", "Hanford-Corcoran unemployment rate", "unemployment_rate", "All Industries", "all", "Hanford-Corcoran", "metro", "monthly"),
    ("LAUMT063290000000003", "Merced unemployment rate", "unemployment_rate", "All Industries", "all", "Merced", "metro", "monthly"),
    ("LAUMT063370000000003", "Modesto unemployment rate", "unemployment_rate", "All Industries", "all", "Modesto", "metro", "monthly"),
    ("LAUMT063490000000003", "Napa unemployment rate", "unemployment_rate", "All Industries", "all", "Napa", "metro", "monthly"),
    ("LAUMT063710000000003", "Oxnard-Thousand Oaks-Ventura unemployment rate", "unemployment_rate", "All Industries", "all", "Oxnard-Thousand Oaks-Ventura", "metro", "monthly"),
    ("LAUMT063982000000003", "Redding unemployment rate", "unemployment_rate", "All Industries", "all", "Redding", "metro", "monthly"),
    ("LAUMT064014000000003", "Riverside-San Bernardino-Ontario unemployment rate", "unemployment_rate", "All Industries", "all", "Riverside-San Bernardino-Ontario", "metro", "monthly"),
    ("LAUMT064090000000003", "Sacramento-Roseville-Folsom unemployment rate", "unemployment_rate", "All Industries", "all", "Sacramento-Roseville-Folsom", "metro", "monthly"),
    ("LAUMT064150000000003", "Salinas unemployment rate", "unemployment_rate", "All Industries", "all", "Salinas", "metro", "monthly"),
    ("LAUMT064174000000003", "San Diego-Chula Vista-Carlsbad unemployment rate", "unemployment_rate", "All Industries", "all", "San Diego-Chula Vista-Carlsbad", "metro", "monthly"),
    ("LAUMT064194000000003", "San Jose-Sunnyvale-Santa Clara unemployment rate", "unemployment_rate", "All Industries", "all", "San Jose-Sunnyvale-Santa Clara", "metro", "monthly"),
    ("LAUMT064202000000003", "San Luis Obispo-Paso Robles unemployment rate", "unemployment_rate", "All Industries", "all", "San Luis Obispo-Paso Robles", "metro", "monthly"),
    ("LAUMT064210000000003", "Santa Cruz-Watsonville unemployment rate", "unemployment_rate", "All Industries", "all", "Santa Cruz-Watsonville", "metro", "monthly"),
    ("LAUMT064220000000003", "Santa Maria-Santa Barbara unemployment rate", "unemployment_rate", "All Industries", "all", "Santa Maria-Santa Barbara", "metro", "monthly"),
    ("LAUMT064222000000003", "Santa Rosa-Petaluma unemployment rate", "unemployment_rate", "All Industries", "all", "Santa Rosa-Petaluma", "metro", "monthly"),
    ("LAUMT064470000000003", "Stockton-Lodi unemployment rate", "unemployment_rate", "All Industries", "all", "Stockton-Lodi", "metro", "monthly"),
    ("LAUMT064670000000003", "Vallejo unemployment rate", "unemployment_rate", "All Industries", "all", "Vallejo", "metro", "monthly"),
    ("LAUMT064730000000003", "Visalia unemployment rate", "unemployment_rate", "All Industries", "all", "Visalia", "metro", "monthly"),
    ("LAUMT064970000000003", "Yuba City unemployment rate", "unemployment_rate", "All Industries", "all", "Yuba City", "metro", "monthly"),
    ("LAUMT081450000000003", "Boulder unemployment rate", "unemployment_rate", "All Industries", "all", "Boulder", "metro", "monthly"),
    ("LAUMT081782000000003", "Colorado Springs unemployment rate", "unemployment_rate", "All Industries", "all", "Colorado Springs", "metro", "monthly"),
    ("LAUMT081974000000003", "Denver-Aurora-Centennial unemployment rate", "unemployment_rate", "All Industries", "all", "Denver-Aurora-Centennial", "metro", "monthly"),
    ("LAUMT082266000000003", "Fort Collins-Loveland unemployment rate", "unemployment_rate", "All Industries", "all", "Fort Collins-Loveland", "metro", "monthly"),
    ("LAUMT082430000000003", "Grand Junction unemployment rate", "unemployment_rate", "All Industries", "all", "Grand Junction", "metro", "monthly"),
    ("LAUMT082454000000003", "Greeley unemployment rate", "unemployment_rate", "All Industries", "all", "Greeley", "metro", "monthly"),
    ("LAUMT083938000000003", "Pueblo unemployment rate", "unemployment_rate", "All Industries", "all", "Pueblo", "metro", "monthly"),
    ("LAUMT091486000000003", "Bridgeport-Stamford-Danbury unemployment rate", "unemployment_rate", "All Industries", "all", "Bridgeport-Stamford-Danbury", "metro", "monthly"),
    ("LAUMT092554000000003", "Hartford-West Hartford-East Hartford unemployment rate", "unemployment_rate", "All Industries", "all", "Hartford-West Hartford-East Hartford", "metro", "monthly"),
    ("LAUMT093530000000003", "New Haven unemployment rate", "unemployment_rate", "All Industries", "all", "New Haven", "metro", "monthly"),
    ("LAUMT093598000000003", "Norwich-New London-Willimantic unemployment rate", "unemployment_rate", "All Industries", "all", "Norwich-New London-Willimantic", "metro", "monthly"),
    ("LAUMT094793000000003", "Waterbury-Shelton unemployment rate", "unemployment_rate", "All Industries", "all", "Waterbury-Shelton", "metro", "monthly"),
    ("LAUMT102010000000003", "Dover unemployment rate", "unemployment_rate", "All Industries", "all", "Dover", "metro", "monthly"),
    ("LAUMT121598000000003", "Cape Coral-Fort Myers unemployment rate", "unemployment_rate", "All Industries", "all", "Cape Coral-Fort Myers", "metro", "monthly"),
    ("LAUMT121888000000003", "Crestview-Fort Walton Beach-Destin unemployment rate", "unemployment_rate", "All Industries", "all", "Crestview-Fort Walton Beach-Destin", "metro", "monthly"),
    ("LAUMT121966000000003", "Deltona-Daytona Beach-Ormond Beach unemployment rate", "unemployment_rate", "All Industries", "all", "Deltona-Daytona Beach-Ormond Beach", "metro", "monthly"),
    ("LAUMT122354000000003", "Gainesville (FL) unemployment rate", "unemployment_rate", "All Industries", "all", "Gainesville (FL)", "metro", "monthly"),
    ("LAUMT122614000000003", "Homosassa Springs unemployment rate", "unemployment_rate", "All Industries", "all", "Homosassa Springs", "metro", "monthly"),
    ("LAUMT122726000000003", "Jacksonville (FL) unemployment rate", "unemployment_rate", "All Industries", "all", "Jacksonville (FL)", "metro", "monthly"),
    ("LAUMT122946000000003", "Lakeland-Winter Haven unemployment rate", "unemployment_rate", "All Industries", "all", "Lakeland-Winter Haven", "metro", "monthly"),
    ("LAUMT123494000000003", "Naples-Marco Island unemployment rate", "unemployment_rate", "All Industries", "all", "Naples-Marco Island", "metro", "monthly"),
    ("LAUMT123584000000003", "North Port-Bradenton-Sarasota unemployment rate", "unemployment_rate", "All Industries", "all", "North Port-Bradenton-Sarasota", "metro", "monthly"),
    ("LAUMT123610000000003", "Ocala unemployment rate", "unemployment_rate", "All Industries", "all", "Ocala", "metro", "monthly"),
    ("LAUMT123674000000003", "Orlando-Kissimmee-Sanford unemployment rate", "unemployment_rate", "All Industries", "all", "Orlando-Kissimmee-Sanford", "metro", "monthly"),
    ("LAUMT123734000000003", "Palm Bay-Melbourne-Titusville unemployment rate", "unemployment_rate", "All Industries", "all", "Palm Bay-Melbourne-Titusville", "metro", "monthly"),
    ("LAUMT123746000000003", "Panama City-Panama City Beach unemployment rate", "unemployment_rate", "All Industries", "all", "Panama City-Panama City Beach", "metro", "monthly"),
    ("LAUMT123786000000003", "Pensacola-Ferry Pass-Brent unemployment rate", "unemployment_rate", "All Industries", "all", "Pensacola-Ferry Pass-Brent", "metro", "monthly"),
    ("LAUMT123894000000003", "Port St. Lucie unemployment rate", "unemployment_rate", "All Industries", "all", "Port St. Lucie", "metro", "monthly"),
    ("LAUMT123946000000003", "Punta Gorda unemployment rate", "unemployment_rate", "All Industries", "all", "Punta Gorda", "metro", "monthly"),
    ("LAUMT124268000000003", "Sebastian-Vero Beach-West Vero Corridor unemployment rate", "unemployment_rate", "All Industries", "all", "Sebastian-Vero Beach-West Vero Corridor", "metro", "monthly"),
    ("LAUMT124270000000003", "Sebring unemployment rate", "unemployment_rate", "All Industries", "all", "Sebring", "metro", "monthly"),
    ("LAUMT124522000000003", "Tallahassee unemployment rate", "unemployment_rate", "All Industries", "all", "Tallahassee", "metro", "monthly"),
    ("LAUMT124530000000003", "Tampa-St. Petersburg-Clearwater unemployment rate", "unemployment_rate", "All Industries", "all", "Tampa-St. Petersburg-Clearwater", "metro", "monthly"),
    ("LAUMT124868000000003", "Wildwood-The Villages unemployment rate", "unemployment_rate", "All Industries", "all", "Wildwood-The Villages", "metro", "monthly"),
    ("LAUMT131050000000003", "Albany (GA) unemployment rate", "unemployment_rate", "All Industries", "all", "Albany (GA)", "metro", "monthly"),
    ("LAUMT131202000000003", "Athens-Clarke County unemployment rate", "unemployment_rate", "All Industries", "all", "Athens-Clarke County", "metro", "monthly"),
    ("LAUMT131226000000003", "Augusta-Richmond County unemployment rate", "unemployment_rate", "All Industries", "all", "Augusta-Richmond County", "metro", "monthly"),
    ("LAUMT131526000000003", "Brunswick-St. Simons unemployment rate", "unemployment_rate", "All Industries", "all", "Brunswick-St. Simons", "metro", "monthly"),
    ("LAUMT131798000000003", "Columbus (GA) unemployment rate", "unemployment_rate", "All Industries", "all", "Columbus (GA)", "metro", "monthly"),
    ("LAUMT131914000000003", "Dalton unemployment rate", "unemployment_rate", "All Industries", "all", "Dalton", "metro", "monthly"),
    ("LAUMT132358000000003", "Gainesville (GA) unemployment rate", "unemployment_rate", "All Industries", "all", "Gainesville (GA)", "metro", "monthly"),
    ("LAUMT132598000000003", "Hinesville unemployment rate", "unemployment_rate", "All Industries", "all", "Hinesville", "metro", "monthly"),
    ("LAUMT133142000000003", "Macon-Bibb County unemployment rate", "unemployment_rate", "All Industries", "all", "Macon-Bibb County", "metro", "monthly"),
    ("LAUMT134066000000003", "Rome unemployment rate", "unemployment_rate", "All Industries", "all", "Rome", "metro", "monthly"),
    ("LAUMT134234000000003", "Savannah unemployment rate", "unemployment_rate", "All Industries", "all", "Savannah", "metro", "monthly"),
    ("LAUMT134666000000003", "Valdosta unemployment rate", "unemployment_rate", "All Industries", "all", "Valdosta", "metro", "monthly"),
    ("LAUMT134758000000003", "Warner Robins unemployment rate", "unemployment_rate", "All Industries", "all", "Warner Robins", "metro", "monthly"),
    ("LAUMT152798000000003", "Kahului-Wailuku unemployment rate", "unemployment_rate", "All Industries", "all", "Kahului-Wailuku", "metro", "monthly"),
    ("LAUMT154652000000003", "Urban Honolulu unemployment rate", "unemployment_rate", "All Industries", "all", "Urban Honolulu", "metro", "monthly"),
    ("LAUMT161426000000003", "Boise City unemployment rate", "unemployment_rate", "All Industries", "all", "Boise City", "metro", "monthly"),
    ("LAUMT161766000000003", "Coeur d'Alene unemployment rate", "unemployment_rate", "All Industries", "all", "Coeur d'Alene", "metro", "monthly"),
    ("LAUMT162682000000003", "Idaho Falls unemployment rate", "unemployment_rate", "All Industries", "all", "Idaho Falls", "metro", "monthly"),
    ("LAUMT163030000000003", "Lewiston unemployment rate", "unemployment_rate", "All Industries", "all", "Lewiston", "metro", "monthly"),
    ("LAUMT163854000000003", "Pocatello unemployment rate", "unemployment_rate", "All Industries", "all", "Pocatello", "metro", "monthly"),
    ("LAUMT164630000000003", "Twin Falls unemployment rate", "unemployment_rate", "All Industries", "all", "Twin Falls", "metro", "monthly"),
    ("LAUMT171401000000003", "Bloomington (IL) unemployment rate", "unemployment_rate", "All Industries", "all", "Bloomington (IL)", "metro", "monthly"),
    ("LAUMT171658000000003", "Champaign-Urbana unemployment rate", "unemployment_rate", "All Industries", "all", "Champaign-Urbana", "metro", "monthly"),
    ("LAUMT171934000000003", "Davenport-Moline-Rock Island unemployment rate", "unemployment_rate", "All Industries", "all", "Davenport-Moline-Rock Island", "metro", "monthly"),
    ("LAUMT171950000000003", "Decatur (IL) unemployment rate", "unemployment_rate", "All Industries", "all", "Decatur (IL)", "metro", "monthly"),
    ("LAUMT172810000000003", "Kankakee unemployment rate", "unemployment_rate", "All Industries", "all", "Kankakee", "metro", "monthly"),
    ("LAUMT173790000000003", "Peoria unemployment rate", "unemployment_rate", "All Industries", "all", "Peoria", "metro", "monthly"),
    ("LAUMT174042000000003", "Rockford unemployment rate", "unemployment_rate", "All Industries", "all", "Rockford", "metro", "monthly"),
    ("LAUMT174410000000003", "Springfield (IL) unemployment rate", "unemployment_rate", "All Industries", "all", "Springfield (IL)", "metro", "monthly"),
    ("LAUMT181402000000003", "Bloomington (IN) unemployment rate", "unemployment_rate", "All Industries", "all", "Bloomington (IN)", "metro", "monthly"),
    ("LAUMT181802000000003", "Columbus (IN) unemployment rate", "unemployment_rate", "All Industries", "all", "Columbus (IN)", "metro", "monthly"),
    ("LAUMT182114000000003", "Elkhart-Goshen unemployment rate", "unemployment_rate", "All Industries", "all", "Elkhart-Goshen", "metro", "monthly"),
    ("LAUMT182178000000003", "Evansville unemployment rate", "unemployment_rate", "All Industries", "all", "Evansville", "metro", "monthly"),
    ("LAUMT182306000000003", "Fort Wayne unemployment rate", "unemployment_rate", "All Industries", "all", "Fort Wayne", "metro", "monthly"),
    ("LAUMT182690000000003", "Indianapolis-Carmel-Greenwood unemployment rate", "unemployment_rate", "All Industries", "all", "Indianapolis-Carmel-Greenwood", "metro", "monthly"),
    ("LAUMT182902000000003", "Kokomo unemployment rate", "unemployment_rate", "All Industries", "all", "Kokomo", "metro", "monthly"),
    ("LAUMT182920000000003", "Lafayette-West Lafayette unemployment rate", "unemployment_rate", "All Industries", "all", "Lafayette-West Lafayette", "metro", "monthly"),
    ("LAUMT183314000000003", "Michigan City-La Porte unemployment rate", "unemployment_rate", "All Industries", "all", "Michigan City-La Porte", "metro", "monthly"),
    ("LAUMT183462000000003", "Muncie unemployment rate", "unemployment_rate", "All Industries", "all", "Muncie", "metro", "monthly"),
    ("LAUMT184378000000003", "South Bend-Mishawaka unemployment rate", "unemployment_rate", "All Industries", "all", "South Bend-Mishawaka", "metro", "monthly"),
    ("LAUMT184546000000003", "Terre Haute unemployment rate", "unemployment_rate", "All Industries", "all", "Terre Haute", "metro", "monthly"),
    ("LAUMT191118000000003", "Ames unemployment rate", "unemployment_rate", "All Industries", "all", "Ames", "metro", "monthly"),
    ("LAUMT191630000000003", "Cedar Rapids unemployment rate", "unemployment_rate", "All Industries", "all", "Cedar Rapids", "metro", "monthly"),
    ("LAUMT191978000000003", "Des Moines-West Des Moines unemployment rate", "unemployment_rate", "All Industries", "all", "Des Moines-West Des Moines", "metro", "monthly"),
    ("LAUMT192022000000003", "Dubuque unemployment rate", "unemployment_rate", "All Industries", "all", "Dubuque", "metro", "monthly"),
    ("LAUMT192698000000003", "Iowa City unemployment rate", "unemployment_rate", "All Industries", "all", "Iowa City", "metro", "monthly"),
    ("LAUMT194358000000003", "Sioux City unemployment rate", "unemployment_rate", "All Industries", "all", "Sioux City", "metro", "monthly"),
    ("LAUMT194794000000003", "Waterloo-Cedar Falls unemployment rate", "unemployment_rate", "All Industries", "all", "Waterloo-Cedar Falls", "metro", "monthly"),
    ("LAUMT202994000000003", "Lawrence unemployment rate", "unemployment_rate", "All Industries", "all", "Lawrence", "metro", "monthly"),
    ("LAUMT203174000000003", "Manhattan unemployment rate", "unemployment_rate", "All Industries", "all", "Manhattan", "metro", "monthly"),
    ("LAUMT204582000000003", "Topeka unemployment rate", "unemployment_rate", "All Industries", "all", "Topeka", "metro", "monthly"),
    ("LAUMT204862000000003", "Wichita unemployment rate", "unemployment_rate", "All Industries", "all", "Wichita", "metro", "monthly"),
    ("LAUMT211454000000003", "Bowling Green unemployment rate", "unemployment_rate", "All Industries", "all", "Bowling Green", "metro", "monthly"),
    ("LAUMT212106000000003", "Elizabethtown unemployment rate", "unemployment_rate", "All Industries", "all", "Elizabethtown", "metro", "monthly"),
    ("LAUMT213046000000003", "Lexington-Fayette unemployment rate", "unemployment_rate", "All Industries", "all", "Lexington-Fayette", "metro", "monthly"),
    ("LAUMT213114000000003", "Louisville/Jefferson County unemployment rate", "unemployment_rate", "All Industries", "all", "Louisville/Jefferson County", "metro", "monthly"),
    ("LAUMT213698000000003", "Owensboro unemployment rate", "unemployment_rate", "All Industries", "all", "Owensboro", "metro", "monthly"),
    ("LAUMT213714000000003", "Paducah unemployment rate", "unemployment_rate", "All Industries", "all", "Paducah", "metro", "monthly"),
    ("LAUMT221078000000003", "Alexandria unemployment rate", "unemployment_rate", "All Industries", "all", "Alexandria", "metro", "monthly"),
    ("LAUMT221294000000003", "Baton Rouge unemployment rate", "unemployment_rate", "All Industries", "all", "Baton Rouge", "metro", "monthly"),
    ("LAUMT222522000000003", "Hammond unemployment rate", "unemployment_rate", "All Industries", "all", "Hammond", "metro", "monthly"),
    ("LAUMT222638000000003", "Houma-Bayou Cane-Thibodaux unemployment rate", "unemployment_rate", "All Industries", "all", "Houma-Bayou Cane-Thibodaux", "metro", "monthly"),
    ("LAUMT222918000000003", "Lafayette unemployment rate", "unemployment_rate", "All Industries", "all", "Lafayette", "metro", "monthly"),
    ("LAUMT222934000000003", "Lake Charles unemployment rate", "unemployment_rate", "All Industries", "all", "Lake Charles", "metro", "monthly"),
    ("LAUMT223374000000003", "Monroe (LA) unemployment rate", "unemployment_rate", "All Industries", "all", "Monroe (LA)", "metro", "monthly"),
    ("LAUMT223538000000003", "New Orleans-Metairie unemployment rate", "unemployment_rate", "All Industries", "all", "New Orleans-Metairie", "metro", "monthly"),
    ("LAUMT224334000000003", "Shreveport-Bossier City unemployment rate", "unemployment_rate", "All Industries", "all", "Shreveport-Bossier City", "metro", "monthly"),
    ("LAUMT224364000000003", "Slidell-Mandeville-Covington unemployment rate", "unemployment_rate", "All Industries", "all", "Slidell-Mandeville-Covington", "metro", "monthly"),
    ("LAUMT231262000000003", "Bangor unemployment rate", "unemployment_rate", "All Industries", "all", "Bangor", "metro", "monthly"),
    ("LAUMT233034000000003", "Lewiston-Auburn unemployment rate", "unemployment_rate", "All Industries", "all", "Lewiston-Auburn", "metro", "monthly"),
    ("LAUMT233886000000003", "Portland-South Portland unemployment rate", "unemployment_rate", "All Industries", "all", "Portland-South Portland", "metro", "monthly"),
    ("LAUMT241258000000003", "Baltimore-Columbia-Towson unemployment rate", "unemployment_rate", "All Industries", "all", "Baltimore-Columbia-Towson", "metro", "monthly"),
    ("LAUMT242518000000003", "Hagerstown-Martinsburg unemployment rate", "unemployment_rate", "All Industries", "all", "Hagerstown-Martinsburg", "metro", "monthly"),
    ("LAUMT243050000000003", "Lexington Park unemployment rate", "unemployment_rate", "All Industries", "all", "Lexington Park", "metro", "monthly"),
    ("LAUMT244154000000003", "Salisbury unemployment rate", "unemployment_rate", "All Industries", "all", "Salisbury", "metro", "monthly"),
    ("LAUMT251120000000003", "Amherst Town-Northampton unemployment rate", "unemployment_rate", "All Industries", "all", "Amherst Town-Northampton", "metro", "monthly"),
    ("LAUMT251270000000003", "Barnstable Town unemployment rate", "unemployment_rate", "All Industries", "all", "Barnstable Town", "metro", "monthly"),
    ("LAUMT253834000000003", "Pittsfield unemployment rate", "unemployment_rate", "All Industries", "all", "Pittsfield", "metro", "monthly"),
    ("LAUMT254414000000003", "Springfield (MA) unemployment rate", "unemployment_rate", "All Industries", "all", "Springfield (MA)", "metro", "monthly"),
    ("LAUMT254934000000003", "Worcester unemployment rate", "unemployment_rate", "All Industries", "all", "Worcester", "metro", "monthly"),
    ("LAUMT261146000000003", "Ann Arbor unemployment rate", "unemployment_rate", "All Industries", "all", "Ann Arbor", "metro", "monthly"),
    ("LAUMT261298000000003", "Battle Creek unemployment rate", "unemployment_rate", "All Industries", "all", "Battle Creek", "metro", "monthly"),
    ("LAUMT261302000000003", "Bay City unemployment rate", "unemployment_rate", "All Industries", "all", "Bay City", "metro", "monthly"),
    ("LAUMT261982000000003", "Detroit-Warren-Dearborn unemployment rate", "unemployment_rate", "All Industries", "all", "Detroit-Warren-Dearborn", "metro", "monthly"),
    ("LAUMT262242000000003", "Flint unemployment rate", "unemployment_rate", "All Industries", "all", "Flint", "metro", "monthly"),
    ("LAUMT262434000000003", "Grand Rapids-Wyoming-Kentwood unemployment rate", "unemployment_rate", "All Industries", "all", "Grand Rapids-Wyoming-Kentwood", "metro", "monthly"),
    ("LAUMT262710000000003", "Jackson (MI) unemployment rate", "unemployment_rate", "All Industries", "all", "Jackson (MI)", "metro", "monthly"),
    ("LAUMT262802000000003", "Kalamazoo-Portage unemployment rate", "unemployment_rate", "All Industries", "all", "Kalamazoo-Portage", "metro", "monthly"),
    ("LAUMT262962000000003", "Lansing-East Lansing unemployment rate", "unemployment_rate", "All Industries", "all", "Lansing-East Lansing", "metro", "monthly"),
    ("LAUMT263322000000003", "Midland (MI) unemployment rate", "unemployment_rate", "All Industries", "all", "Midland (MI)", "metro", "monthly"),
    ("LAUMT263378000000003", "Monroe (MI) unemployment rate", "unemployment_rate", "All Industries", "all", "Monroe (MI)", "metro", "monthly"),
    ("LAUMT263474000000003", "Muskegon-Norton Shores unemployment rate", "unemployment_rate", "All Industries", "all", "Muskegon-Norton Shores", "metro", "monthly"),
    ("LAUMT263566000000003", "Niles unemployment rate", "unemployment_rate", "All Industries", "all", "Niles", "metro", "monthly"),
    ("LAUMT264098000000003", "Saginaw unemployment rate", "unemployment_rate", "All Industries", "all", "Saginaw", "metro", "monthly"),
    ("LAUMT264590000000003", "Traverse City unemployment rate", "unemployment_rate", "All Industries", "all", "Traverse City", "metro", "monthly"),
    ("LAUMT272026000000003", "Duluth unemployment rate", "unemployment_rate", "All Industries", "all", "Duluth", "metro", "monthly"),
    ("LAUMT273186000000003", "Mankato unemployment rate", "unemployment_rate", "All Industries", "all", "Mankato", "metro", "monthly"),
    ("LAUMT273346000000003", "Minneapolis-St. Paul-Bloomington unemployment rate", "unemployment_rate", "All Industries", "all", "Minneapolis-St. Paul-Bloomington", "metro", "monthly"),
    ("LAUMT274034000000003", "Rochester (MN) unemployment rate", "unemployment_rate", "All Industries", "all", "Rochester (MN)", "metro", "monthly"),
    ("LAUMT274106000000003", "St. Cloud unemployment rate", "unemployment_rate", "All Industries", "all", "St. Cloud", "metro", "monthly"),
    ("LAUMT282506000000003", "Gulfport-Biloxi unemployment rate", "unemployment_rate", "All Industries", "all", "Gulfport-Biloxi", "metro", "monthly"),
    ("LAUMT282562000000003", "Hattiesburg unemployment rate", "unemployment_rate", "All Industries", "all", "Hattiesburg", "metro", "monthly"),
    ("LAUMT282714000000003", "Jackson (MS) unemployment rate", "unemployment_rate", "All Industries", "all", "Jackson (MS)", "metro", "monthly"),
    ("LAUMT291602000000003", "Cape Girardeau unemployment rate", "unemployment_rate", "All Industries", "all", "Cape Girardeau", "metro", "monthly"),
    ("LAUMT291786000000003", "Columbia (MO) unemployment rate", "unemployment_rate", "All Industries", "all", "Columbia (MO)", "metro", "monthly"),
    ("LAUMT292762000000003", "Jefferson City unemployment rate", "unemployment_rate", "All Industries", "all", "Jefferson City", "metro", "monthly"),
    ("LAUMT292790000000003", "Joplin unemployment rate", "unemployment_rate", "All Industries", "all", "Joplin", "metro", "monthly"),
    ("LAUMT292814000000003", "Kansas City unemployment rate", "unemployment_rate", "All Industries", "all", "Kansas City", "metro", "monthly"),
    ("LAUMT294114000000003", "St. Joseph unemployment rate", "unemployment_rate", "All Industries", "all", "St. Joseph", "metro", "monthly"),
    ("LAUMT294118000000003", "St. Louis unemployment rate", "unemployment_rate", "All Industries", "all", "St. Louis", "metro", "monthly"),
    ("LAUMT294418000000003", "Springfield (MO) unemployment rate", "unemployment_rate", "All Industries", "all", "Springfield (MO)", "metro", "monthly"),
    ("LAUMT301374000000003", "Billings unemployment rate", "unemployment_rate", "All Industries", "all", "Billings", "metro", "monthly"),
    ("LAUMT301458000000003", "Bozeman unemployment rate", "unemployment_rate", "All Industries", "all", "Bozeman", "metro", "monthly"),
    ("LAUMT302450000000003", "Great Falls unemployment rate", "unemployment_rate", "All Industries", "all", "Great Falls", "metro", "monthly"),
    ("LAUMT302574000000003", "Helena unemployment rate", "unemployment_rate", "All Industries", "all", "Helena", "metro", "monthly"),
    ("LAUMT303354000000003", "Missoula unemployment rate", "unemployment_rate", "All Industries", "all", "Missoula", "metro", "monthly"),
    ("LAUMT312426000000003", "Grand Island unemployment rate", "unemployment_rate", "All Industries", "all", "Grand Island", "metro", "monthly"),
    ("LAUMT313070000000003", "Lincoln unemployment rate", "unemployment_rate", "All Industries", "all", "Lincoln", "metro", "monthly"),
    ("LAUMT313654000000003", "Omaha unemployment rate", "unemployment_rate", "All Industries", "all", "Omaha", "metro", "monthly"),
    ("LAUMT321618000000003", "Carson City unemployment rate", "unemployment_rate", "All Industries", "all", "Carson City", "metro", "monthly"),
    ("LAUMT322982000000003", "Las Vegas-Henderson-North Las Vegas unemployment rate", "unemployment_rate", "All Industries", "all", "Las Vegas-Henderson-North Las Vegas", "metro", "monthly"),
    ("LAUMT323990000000003", "Reno unemployment rate", "unemployment_rate", "All Industries", "all", "Reno", "metro", "monthly"),
    ("LAUMT333170000000003", "Manchester-Nashua unemployment rate", "unemployment_rate", "All Industries", "all", "Manchester-Nashua", "metro", "monthly"),
    ("LAUMT341210000000003", "Atlantic City-Hammonton unemployment rate", "unemployment_rate", "All Industries", "all", "Atlantic City-Hammonton", "metro", "monthly"),
    ("LAUMT344594000000003", "Trenton-Princeton unemployment rate", "unemployment_rate", "All Industries", "all", "Trenton-Princeton", "metro", "monthly"),
    ("LAUMT344722000000003", "Vineland unemployment rate", "unemployment_rate", "All Industries", "all", "Vineland", "metro", "monthly"),
    ("LAUMT351074000000003", "Albuquerque unemployment rate", "unemployment_rate", "All Industries", "all", "Albuquerque", "metro", "monthly"),
    ("LAUMT352214000000003", "Farmington unemployment rate", "unemployment_rate", "All Industries", "all", "Farmington", "metro", "monthly"),
    ("LAUMT352974000000003", "Las Cruces unemployment rate", "unemployment_rate", "All Industries", "all", "Las Cruces", "metro", "monthly"),
    ("LAUMT354214000000003", "Santa Fe unemployment rate", "unemployment_rate", "All Industries", "all", "Santa Fe", "metro", "monthly"),
    ("LAUMT361058000000003", "Albany-Schenectady-Troy unemployment rate", "unemployment_rate", "All Industries", "all", "Albany-Schenectady-Troy", "metro", "monthly"),
    ("LAUMT361378000000003", "Binghamton unemployment rate", "unemployment_rate", "All Industries", "all", "Binghamton", "metro", "monthly"),
    ("LAUMT361538000000003", "Buffalo-Cheektowaga unemployment rate", "unemployment_rate", "All Industries", "all", "Buffalo-Cheektowaga", "metro", "monthly"),
    ("LAUMT362130000000003", "Elmira unemployment rate", "unemployment_rate", "All Industries", "all", "Elmira", "metro", "monthly"),
    ("LAUMT362402000000003", "Glens Falls unemployment rate", "unemployment_rate", "All Industries", "all", "Glens Falls", "metro", "monthly"),
    ("LAUMT362706000000003", "Ithaca unemployment rate", "unemployment_rate", "All Industries", "all", "Ithaca", "metro", "monthly"),
    ("LAUMT362874000000003", "Kingston unemployment rate", "unemployment_rate", "All Industries", "all", "Kingston", "metro", "monthly"),
    ("LAUMT362888000000003", "Kiryas Joel-Poughkeepsie-Newburgh unemployment rate", "unemployment_rate", "All Industries", "all", "Kiryas Joel-Poughkeepsie-Newburgh", "metro", "monthly"),
    ("LAUMT364038000000003", "Rochester (NY) unemployment rate", "unemployment_rate", "All Industries", "all", "Rochester (NY)", "metro", "monthly"),
    ("LAUMT364506000000003", "Syracuse unemployment rate", "unemployment_rate", "All Industries", "all", "Syracuse", "metro", "monthly"),
    ("LAUMT364654000000003", "Utica-Rome unemployment rate", "unemployment_rate", "All Industries", "all", "Utica-Rome", "metro", "monthly"),
    ("LAUMT364806000000003", "Watertown-Fort Drum unemployment rate", "unemployment_rate", "All Industries", "all", "Watertown-Fort Drum", "metro", "monthly"),
    ("LAUMT371170000000003", "Asheville unemployment rate", "unemployment_rate", "All Industries", "all", "Asheville", "metro", "monthly"),
    ("LAUMT371550000000003", "Burlington unemployment rate", "unemployment_rate", "All Industries", "all", "Burlington", "metro", "monthly"),
    ("LAUMT371674000000003", "Charlotte-Concord-Gastonia unemployment rate", "unemployment_rate", "All Industries", "all", "Charlotte-Concord-Gastonia", "metro", "monthly"),
    ("LAUMT372050000000003", "Durham-Chapel Hill unemployment rate", "unemployment_rate", "All Industries", "all", "Durham-Chapel Hill", "metro", "monthly"),
    ("LAUMT372218000000003", "Fayetteville unemployment rate", "unemployment_rate", "All Industries", "all", "Fayetteville", "metro", "monthly"),
    ("LAUMT372414000000003", "Goldsboro unemployment rate", "unemployment_rate", "All Industries", "all", "Goldsboro", "metro", "monthly"),
    ("LAUMT372466000000003", "Greensboro-High Point unemployment rate", "unemployment_rate", "All Industries", "all", "Greensboro-High Point", "metro", "monthly"),
    ("LAUMT372478000000003", "Greenville unemployment rate", "unemployment_rate", "All Industries", "all", "Greenville", "metro", "monthly"),
    ("LAUMT372586000000003", "Hickory-Lenoir-Morganton unemployment rate", "unemployment_rate", "All Industries", "all", "Hickory-Lenoir-Morganton", "metro", "monthly"),
    ("LAUMT372734000000003", "Jacksonville (NC) unemployment rate", "unemployment_rate", "All Industries", "all", "Jacksonville (NC)", "metro", "monthly"),
    ("LAUMT373824000000003", "Pinehurst-Southern Pines unemployment rate", "unemployment_rate", "All Industries", "all", "Pinehurst-Southern Pines", "metro", "monthly"),
    ("LAUMT373958000000003", "Raleigh-Cary unemployment rate", "unemployment_rate", "All Industries", "all", "Raleigh-Cary", "metro", "monthly"),
    ("LAUMT374058000000003", "Rocky Mount unemployment rate", "unemployment_rate", "All Industries", "all", "Rocky Mount", "metro", "monthly"),
    ("LAUMT374890000000003", "Wilmington unemployment rate", "unemployment_rate", "All Industries", "all", "Wilmington", "metro", "monthly"),
    ("LAUMT374918000000003", "Winston-Salem unemployment rate", "unemployment_rate", "All Industries", "all", "Winston-Salem", "metro", "monthly"),
    ("LAUMT381390000000003", "Bismarck unemployment rate", "unemployment_rate", "All Industries", "all", "Bismarck", "metro", "monthly"),
    ("LAUMT382202000000003", "Fargo unemployment rate", "unemployment_rate", "All Industries", "all", "Fargo", "metro", "monthly"),
    ("LAUMT382422000000003", "Grand Forks unemployment rate", "unemployment_rate", "All Industries", "all", "Grand Forks", "metro", "monthly"),
    ("LAUMT383350000000003", "Minot unemployment rate", "unemployment_rate", "All Industries", "all", "Minot", "metro", "monthly"),
    ("LAUMT391042000000003", "Akron unemployment rate", "unemployment_rate", "All Industries", "all", "Akron", "metro", "monthly"),
    ("LAUMT391594000000003", "Canton-Massillon unemployment rate", "unemployment_rate", "All Industries", "all", "Canton-Massillon", "metro", "monthly"),
    ("LAUMT391714000000003", "Cincinnati unemployment rate", "unemployment_rate", "All Industries", "all", "Cincinnati", "metro", "monthly"),
    ("LAUMT391741000000003", "Cleveland (OH) unemployment rate", "unemployment_rate", "All Industries", "all", "Cleveland (OH)", "metro", "monthly"),
    ("LAUMT391814000000003", "Columbus (OH) unemployment rate", "unemployment_rate", "All Industries", "all", "Columbus (OH)", "metro", "monthly"),
    ("LAUMT391943000000003", "Dayton-Kettering-Beavercreek unemployment rate", "unemployment_rate", "All Industries", "all", "Dayton-Kettering-Beavercreek", "metro", "monthly"),
    ("LAUMT393062000000003", "Lima unemployment rate", "unemployment_rate", "All Industries", "all", "Lima", "metro", "monthly"),
    ("LAUMT393190000000003", "Mansfield unemployment rate", "unemployment_rate", "All Industries", "all", "Mansfield", "metro", "monthly"),
    ("LAUMT394178000000003", "Sandusky unemployment rate", "unemployment_rate", "All Industries", "all", "Sandusky", "metro", "monthly"),
    ("LAUMT394422000000003", "Springfield (OH) unemployment rate", "unemployment_rate", "All Industries", "all", "Springfield (OH)", "metro", "monthly"),
    ("LAUMT394578000000003", "Toledo unemployment rate", "unemployment_rate", "All Industries", "all", "Toledo", "metro", "monthly"),
    ("LAUMT394826000000003", "Weirton-Steubenville unemployment rate", "unemployment_rate", "All Industries", "all", "Weirton-Steubenville", "metro", "monthly"),
    ("LAUMT394966000000003", "Youngstown-Warren unemployment rate", "unemployment_rate", "All Industries", "all", "Youngstown-Warren", "metro", "monthly"),
    ("LAUMT402142000000003", "Enid unemployment rate", "unemployment_rate", "All Industries", "all", "Enid", "metro", "monthly"),
    ("LAUMT403002000000003", "Lawton unemployment rate", "unemployment_rate", "All Industries", "all", "Lawton", "metro", "monthly"),
    ("LAUMT403642000000003", "Oklahoma City unemployment rate", "unemployment_rate", "All Industries", "all", "Oklahoma City", "metro", "monthly"),
    ("LAUMT404614000000003", "Tulsa unemployment rate", "unemployment_rate", "All Industries", "all", "Tulsa", "metro", "monthly"),
    ("LAUMT411054000000003", "Albany (OR) unemployment rate", "unemployment_rate", "All Industries", "all", "Albany (OR)", "metro", "monthly"),
    ("LAUMT411346000000003", "Bend unemployment rate", "unemployment_rate", "All Industries", "all", "Bend", "metro", "monthly"),
    ("LAUMT411870000000003", "Corvallis unemployment rate", "unemployment_rate", "All Industries", "all", "Corvallis", "metro", "monthly"),
    ("LAUMT412166000000003", "Eugene-Springfield unemployment rate", "unemployment_rate", "All Industries", "all", "Eugene-Springfield", "metro", "monthly"),
    ("LAUMT412442000000003", "Grants Pass unemployment rate", "unemployment_rate", "All Industries", "all", "Grants Pass", "metro", "monthly"),
    ("LAUMT413278000000003", "Medford unemployment rate", "unemployment_rate", "All Industries", "all", "Medford", "metro", "monthly"),
    ("LAUMT413890000000003", "Portland-Vancouver-Hillsboro unemployment rate", "unemployment_rate", "All Industries", "all", "Portland-Vancouver-Hillsboro", "metro", "monthly"),
    ("LAUMT414142000000003", "Salem unemployment rate", "unemployment_rate", "All Industries", "all", "Salem", "metro", "monthly"),
    ("LAUMT421090000000003", "Allentown-Bethlehem-Easton unemployment rate", "unemployment_rate", "All Industries", "all", "Allentown-Bethlehem-Easton", "metro", "monthly"),
    ("LAUMT421102000000003", "Altoona unemployment rate", "unemployment_rate", "All Industries", "all", "Altoona", "metro", "monthly"),
    ("LAUMT421654000000003", "Chambersburg unemployment rate", "unemployment_rate", "All Industries", "all", "Chambersburg", "metro", "monthly"),
    ("LAUMT422150000000003", "Erie unemployment rate", "unemployment_rate", "All Industries", "all", "Erie", "metro", "monthly"),
    ("LAUMT422390000000003", "Gettysburg unemployment rate", "unemployment_rate", "All Industries", "all", "Gettysburg", "metro", "monthly"),
    ("LAUMT422542000000003", "Harrisburg-Carlisle unemployment rate", "unemployment_rate", "All Industries", "all", "Harrisburg-Carlisle", "metro", "monthly"),
    ("LAUMT422778000000003", "Johnstown unemployment rate", "unemployment_rate", "All Industries", "all", "Johnstown", "metro", "monthly"),
    ("LAUMT422954000000003", "Lancaster unemployment rate", "unemployment_rate", "All Industries", "all", "Lancaster", "metro", "monthly"),
    ("LAUMT423014000000003", "Lebanon unemployment rate", "unemployment_rate", "All Industries", "all", "Lebanon", "metro", "monthly"),
    ("LAUMT423798000000003", "Philadelphia-Camden-Wilmington unemployment rate", "unemployment_rate", "All Industries", "all", "Philadelphia-Camden-Wilmington", "metro", "monthly"),
    ("LAUMT423830000000003", "Pittsburgh unemployment rate", "unemployment_rate", "All Industries", "all", "Pittsburgh", "metro", "monthly"),
    ("LAUMT423974000000003", "Reading unemployment rate", "unemployment_rate", "All Industries", "all", "Reading", "metro", "monthly"),
    ("LAUMT424254000000003", "Scranton--Wilkes-Barre unemployment rate", "unemployment_rate", "All Industries", "all", "Scranton--Wilkes-Barre", "metro", "monthly"),
    ("LAUMT424430000000003", "State College unemployment rate", "unemployment_rate", "All Industries", "all", "State College", "metro", "monthly"),
    ("LAUMT424870000000003", "Williamsport unemployment rate", "unemployment_rate", "All Industries", "all", "Williamsport", "metro", "monthly"),
    ("LAUMT424962000000003", "York-Hanover unemployment rate", "unemployment_rate", "All Industries", "all", "York-Hanover", "metro", "monthly"),
    ("LAUMT443930000000003", "Providence-Warwick unemployment rate", "unemployment_rate", "All Industries", "all", "Providence-Warwick", "metro", "monthly"),
    ("LAUMT451670000000003", "Charleston-North Charleston unemployment rate", "unemployment_rate", "All Industries", "all", "Charleston-North Charleston", "metro", "monthly"),
    ("LAUMT451790000000003", "Columbia (SC) unemployment rate", "unemployment_rate", "All Industries", "all", "Columbia (SC)", "metro", "monthly"),
    ("LAUMT452250000000003", "Florence unemployment rate", "unemployment_rate", "All Industries", "all", "Florence", "metro", "monthly"),
    ("LAUMT452486000000003", "Greenville-Anderson-Greer unemployment rate", "unemployment_rate", "All Industries", "all", "Greenville-Anderson-Greer", "metro", "monthly"),
    ("LAUMT452594000000003", "Hilton Head Island-Bluffton-Port Royal unemployment rate", "unemployment_rate", "All Industries", "all", "Hilton Head Island-Bluffton-Port Royal", "metro", "monthly"),
    ("LAUMT453482000000003", "Myrtle Beach-Conway-North Myrtle Beach unemployment rate", "unemployment_rate", "All Industries", "all", "Myrtle Beach-Conway-North Myrtle Beach", "metro", "monthly"),
    ("LAUMT454390000000003", "Spartanburg unemployment rate", "unemployment_rate", "All Industries", "all", "Spartanburg", "metro", "monthly"),
    ("LAUMT454494000000003", "Sumter unemployment rate", "unemployment_rate", "All Industries", "all", "Sumter", "metro", "monthly"),
    ("LAUMT463966000000003", "Rapid City unemployment rate", "unemployment_rate", "All Industries", "all", "Rapid City", "metro", "monthly"),
    ("LAUMT464362000000003", "Sioux Falls unemployment rate", "unemployment_rate", "All Industries", "all", "Sioux Falls", "metro", "monthly"),
    ("LAUMT471686000000003", "Chattanooga unemployment rate", "unemployment_rate", "All Industries", "all", "Chattanooga", "metro", "monthly"),
    ("LAUMT471730000000003", "Clarksville unemployment rate", "unemployment_rate", "All Industries", "all", "Clarksville", "metro", "monthly"),
    ("LAUMT471742000000003", "Cleveland (TN) unemployment rate", "unemployment_rate", "All Industries", "all", "Cleveland (TN)", "metro", "monthly"),
    ("LAUMT472718000000003", "Jackson (TN) unemployment rate", "unemployment_rate", "All Industries", "all", "Jackson (TN)", "metro", "monthly"),
    ("LAUMT472774000000003", "Johnson City unemployment rate", "unemployment_rate", "All Industries", "all", "Johnson City", "metro", "monthly"),
    ("LAUMT472870000000003", "Kingsport-Bristol unemployment rate", "unemployment_rate", "All Industries", "all", "Kingsport-Bristol", "metro", "monthly"),
    ("LAUMT472894000000003", "Knoxville unemployment rate", "unemployment_rate", "All Industries", "all", "Knoxville", "metro", "monthly"),
    ("LAUMT473282000000003", "Memphis unemployment rate", "unemployment_rate", "All Industries", "all", "Memphis", "metro", "monthly"),
    ("LAUMT473410000000003", "Morristown unemployment rate", "unemployment_rate", "All Industries", "all", "Morristown", "metro", "monthly"),
    ("LAUMT473498000000003", "Nashville-Davidson--Murfreesboro--Franklin unemployment rate", "unemployment_rate", "All Industries", "all", "Nashville-Davidson--Murfreesboro--Franklin", "metro", "monthly"),
    ("LAUMT481018000000003", "Abilene unemployment rate", "unemployment_rate", "All Industries", "all", "Abilene", "metro", "monthly"),
    ("LAUMT481110000000003", "Amarillo unemployment rate", "unemployment_rate", "All Industries", "all", "Amarillo", "metro", "monthly"),
    ("LAUMT481314000000003", "Beaumont-Port Arthur unemployment rate", "unemployment_rate", "All Industries", "all", "Beaumont-Port Arthur", "metro", "monthly"),
    ("LAUMT481518000000003", "Brownsville-Harlingen unemployment rate", "unemployment_rate", "All Industries", "all", "Brownsville-Harlingen", "metro", "monthly"),
    ("LAUMT481778000000003", "College Station-Bryan unemployment rate", "unemployment_rate", "All Industries", "all", "College Station-Bryan", "metro", "monthly"),
    ("LAUMT481858000000003", "Corpus Christi unemployment rate", "unemployment_rate", "All Industries", "all", "Corpus Christi", "metro", "monthly"),
    ("LAUMT482058000000003", "Eagle Pass unemployment rate", "unemployment_rate", "All Industries", "all", "Eagle Pass", "metro", "monthly"),
    ("LAUMT482134000000003", "El Paso unemployment rate", "unemployment_rate", "All Industries", "all", "El Paso", "metro", "monthly"),
    ("LAUMT482642000000003", "Houston-Pasadena-The Woodlands unemployment rate", "unemployment_rate", "All Industries", "all", "Houston-Pasadena-The Woodlands", "metro", "monthly"),
    ("LAUMT482866000000003", "Killeen-Temple unemployment rate", "unemployment_rate", "All Industries", "all", "Killeen-Temple", "metro", "monthly"),
    ("LAUMT482970000000003", "Laredo unemployment rate", "unemployment_rate", "All Industries", "all", "Laredo", "metro", "monthly"),
    ("LAUMT483098000000003", "Longview unemployment rate", "unemployment_rate", "All Industries", "all", "Longview", "metro", "monthly"),
    ("LAUMT483118000000003", "Lubbock unemployment rate", "unemployment_rate", "All Industries", "all", "Lubbock", "metro", "monthly"),
    ("LAUMT483258000000003", "McAllen-Edinburg-Mission unemployment rate", "unemployment_rate", "All Industries", "all", "McAllen-Edinburg-Mission", "metro", "monthly"),
    ("LAUMT483326000000003", "Midland (TX) unemployment rate", "unemployment_rate", "All Industries", "all", "Midland (TX)", "metro", "monthly"),
    ("LAUMT483622000000003", "Odessa unemployment rate", "unemployment_rate", "All Industries", "all", "Odessa", "metro", "monthly"),
    ("LAUMT484166000000003", "San Angelo unemployment rate", "unemployment_rate", "All Industries", "all", "San Angelo", "metro", "monthly"),
    ("LAUMT484170000000003", "San Antonio-New Braunfels unemployment rate", "unemployment_rate", "All Industries", "all", "San Antonio-New Braunfels", "metro", "monthly"),
    ("LAUMT484330000000003", "Sherman-Denison unemployment rate", "unemployment_rate", "All Industries", "all", "Sherman-Denison", "metro", "monthly"),
    ("LAUMT484550000000003", "Texarkana unemployment rate", "unemployment_rate", "All Industries", "all", "Texarkana", "metro", "monthly"),
    ("LAUMT484634000000003", "Tyler unemployment rate", "unemployment_rate", "All Industries", "all", "Tyler", "metro", "monthly"),
    ("LAUMT484702000000003", "Victoria unemployment rate", "unemployment_rate", "All Industries", "all", "Victoria", "metro", "monthly"),
    ("LAUMT484738000000003", "Waco unemployment rate", "unemployment_rate", "All Industries", "all", "Waco", "metro", "monthly"),
    ("LAUMT484866000000003", "Wichita Falls unemployment rate", "unemployment_rate", "All Industries", "all", "Wichita Falls", "metro", "monthly"),
    ("LAUMT493086000000003", "Logan unemployment rate", "unemployment_rate", "All Industries", "all", "Logan", "metro", "monthly"),
    ("LAUMT493626000000003", "Ogden unemployment rate", "unemployment_rate", "All Industries", "all", "Ogden", "metro", "monthly"),
    ("LAUMT493934000000003", "Provo-Orem-Lehi unemployment rate", "unemployment_rate", "All Industries", "all", "Provo-Orem-Lehi", "metro", "monthly"),
    ("LAUMT494110000000003", "St. George unemployment rate", "unemployment_rate", "All Industries", "all", "St. George", "metro", "monthly"),
    ("LAUMT494162000000003", "Salt Lake City-Murray unemployment rate", "unemployment_rate", "All Industries", "all", "Salt Lake City-Murray", "metro", "monthly"),
    ("LAUMT501554000000003", "Burlington-South Burlington unemployment rate", "unemployment_rate", "All Industries", "all", "Burlington-South Burlington", "metro", "monthly"),
    ("LAUMT511398000000003", "Blacksburg-Christiansburg-Radford unemployment rate", "unemployment_rate", "All Industries", "all", "Blacksburg-Christiansburg-Radford", "metro", "monthly"),
    ("LAUMT511682000000003", "Charlottesville unemployment rate", "unemployment_rate", "All Industries", "all", "Charlottesville", "metro", "monthly"),
    ("LAUMT512550000000003", "Harrisonburg unemployment rate", "unemployment_rate", "All Industries", "all", "Harrisonburg", "metro", "monthly"),
    ("LAUMT513134000000003", "Lynchburg unemployment rate", "unemployment_rate", "All Industries", "all", "Lynchburg", "metro", "monthly"),
    ("LAUMT514006000000003", "Richmond unemployment rate", "unemployment_rate", "All Industries", "all", "Richmond", "metro", "monthly"),
    ("LAUMT514022000000003", "Roanoke unemployment rate", "unemployment_rate", "All Industries", "all", "Roanoke", "metro", "monthly"),
    ("LAUMT514442000000003", "Staunton-Stuarts Draft unemployment rate", "unemployment_rate", "All Industries", "all", "Staunton-Stuarts Draft", "metro", "monthly"),
    ("LAUMT514726000000003", "Virginia Beach-Chesapeake-Norfolk unemployment rate", "unemployment_rate", "All Industries", "all", "Virginia Beach-Chesapeake-Norfolk", "metro", "monthly"),
    ("LAUMT514902000000003", "Winchester unemployment rate", "unemployment_rate", "All Industries", "all", "Winchester", "metro", "monthly"),
    ("LAUMT531338000000003", "Bellingham unemployment rate", "unemployment_rate", "All Industries", "all", "Bellingham", "metro", "monthly"),
    ("LAUMT531474000000003", "Bremerton-Silverdale-Port Orchard unemployment rate", "unemployment_rate", "All Industries", "all", "Bremerton-Silverdale-Port Orchard", "metro", "monthly"),
    ("LAUMT532842000000003", "Kennewick-Richland unemployment rate", "unemployment_rate", "All Industries", "all", "Kennewick-Richland", "metro", "monthly"),
    ("LAUMT533102000000003", "Longview-Kelso unemployment rate", "unemployment_rate", "All Industries", "all", "Longview-Kelso", "metro", "monthly"),
    ("LAUMT533458000000003", "Mount Vernon-Anacortes unemployment rate", "unemployment_rate", "All Industries", "all", "Mount Vernon-Anacortes", "metro", "monthly"),
    ("LAUMT533650000000003", "Olympia-Lacey-Tumwater unemployment rate", "unemployment_rate", "All Industries", "all", "Olympia-Lacey-Tumwater", "metro", "monthly"),
    ("LAUMT534406000000003", "Spokane-Spokane Valley unemployment rate", "unemployment_rate", "All Industries", "all", "Spokane-Spokane Valley", "metro", "monthly"),
    ("LAUMT534746000000003", "Walla Walla unemployment rate", "unemployment_rate", "All Industries", "all", "Walla Walla", "metro", "monthly"),
    ("LAUMT534830000000003", "Wenatchee-East Wenatchee unemployment rate", "unemployment_rate", "All Industries", "all", "Wenatchee-East Wenatchee", "metro", "monthly"),
    ("LAUMT534942000000003", "Yakima unemployment rate", "unemployment_rate", "All Industries", "all", "Yakima", "metro", "monthly"),
    ("LAUMT541322000000003", "Beckley unemployment rate", "unemployment_rate", "All Industries", "all", "Beckley", "metro", "monthly"),
    ("LAUMT541662000000003", "Charleston unemployment rate", "unemployment_rate", "All Industries", "all", "Charleston", "metro", "monthly"),
    ("LAUMT542658000000003", "Huntington-Ashland unemployment rate", "unemployment_rate", "All Industries", "all", "Huntington-Ashland", "metro", "monthly"),
    ("LAUMT543406000000003", "Morgantown unemployment rate", "unemployment_rate", "All Industries", "all", "Morgantown", "metro", "monthly"),
    ("LAUMT543762000000003", "Parkersburg-Vienna unemployment rate", "unemployment_rate", "All Industries", "all", "Parkersburg-Vienna", "metro", "monthly"),
    ("LAUMT544854000000003", "Wheeling unemployment rate", "unemployment_rate", "All Industries", "all", "Wheeling", "metro", "monthly"),
    ("LAUMT551154000000003", "Appleton unemployment rate", "unemployment_rate", "All Industries", "all", "Appleton", "metro", "monthly"),
    ("LAUMT552074000000003", "Eau Claire unemployment rate", "unemployment_rate", "All Industries", "all", "Eau Claire", "metro", "monthly"),
    ("LAUMT552254000000003", "Fond du Lac unemployment rate", "unemployment_rate", "All Industries", "all", "Fond du Lac", "metro", "monthly"),
    ("LAUMT552458000000003", "Green Bay unemployment rate", "unemployment_rate", "All Industries", "all", "Green Bay", "metro", "monthly"),
    ("LAUMT552750000000003", "Janesville-Beloit unemployment rate", "unemployment_rate", "All Industries", "all", "Janesville-Beloit", "metro", "monthly"),
    ("LAUMT552845000000003", "Kenosha unemployment rate", "unemployment_rate", "All Industries", "all", "Kenosha", "metro", "monthly"),
    ("LAUMT552910000000003", "La Crosse-Onalaska unemployment rate", "unemployment_rate", "All Industries", "all", "La Crosse-Onalaska", "metro", "monthly"),
    ("LAUMT553154000000003", "Madison unemployment rate", "unemployment_rate", "All Industries", "all", "Madison", "metro", "monthly"),
    ("LAUMT553334000000003", "Milwaukee-Waukesha unemployment rate", "unemployment_rate", "All Industries", "all", "Milwaukee-Waukesha", "metro", "monthly"),
    ("LAUMT553678000000003", "Oshkosh-Neenah unemployment rate", "unemployment_rate", "All Industries", "all", "Oshkosh-Neenah", "metro", "monthly"),
    ("LAUMT553954000000003", "Racine-Mount Pleasant unemployment rate", "unemployment_rate", "All Industries", "all", "Racine-Mount Pleasant", "metro", "monthly"),
    ("LAUMT554310000000003", "Sheboygan unemployment rate", "unemployment_rate", "All Industries", "all", "Sheboygan", "metro", "monthly"),
    ("LAUMT554814000000003", "Wausau unemployment rate", "unemployment_rate", "All Industries", "all", "Wausau", "metro", "monthly"),
    ("LAUMT561622000000003", "Casper unemployment rate", "unemployment_rate", "All Industries", "all", "Casper", "metro", "monthly"),
    ("LAUMT561694000000003", "Cheyenne unemployment rate", "unemployment_rate", "All Industries", "all", "Cheyenne", "metro", "monthly"),
    ("LAUMT721038000000003", "Aguadilla unemployment rate", "unemployment_rate", "All Industries", "all", "Aguadilla", "metro", "monthly"),
    ("LAUMT721164000000003", "Arecibo unemployment rate", "unemployment_rate", "All Industries", "all", "Arecibo", "metro", "monthly"),
    ("LAUMT722502000000003", "Guayama unemployment rate", "unemployment_rate", "All Industries", "all", "Guayama", "metro", "monthly"),
    ("LAUMT723242000000003", "Mayaguez unemployment rate", "unemployment_rate", "All Industries", "all", "Mayaguez", "metro", "monthly"),
    ("LAUMT723866000000003", "Ponce unemployment rate", "unemployment_rate", "All Industries", "all", "Ponce", "metro", "monthly"),
    ("LAUMT724198000000003", "San Juan-Bayamon-Caguas unemployment rate", "unemployment_rate", "All Industries", "all", "San Juan-Bayamon-Caguas", "metro", "monthly"),
]

# ---------------------------------------------------------------------------
# SAE series — state-level payroll employment + avg weekly earnings
# Format: SMS + S(SA) + {state_fips_2} + {area_5} + {industry_8} + {data_type_2}
# Statewide total nonfarm: area=00000, industry=00000000
# Data type 01 = all employees (thousands), 13 = avg weekly earnings
# Key states only for payroll — 50 states × 2 metrics = 100 series which
# exceeds batch limits fast, so we cover the 20 largest labor markets
# plus every state for unemployment (LAUS above covers all 51 already)
# ---------------------------------------------------------------------------
SAE_SERIES = [
    # Total nonfarm payroll employment by state (seasonally adjusted)
    # Format: SMS + S + fips(2) + 00000 + 00000000 + 01
    ("SMS06000000000000001", "California total nonfarm employment",     "employment_level", "Total Nonfarm", "all", "California",    "state", "monthly"),
    ("SMS48000000000000001", "Texas total nonfarm employment",          "employment_level", "Total Nonfarm", "all", "Texas",         "state", "monthly"),
    ("SMS53000000000000001", "Washington total nonfarm employment",     "employment_level", "Total Nonfarm", "all", "Washington",    "state", "monthly"),
    ("SMS36000000000000001", "New York total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "New York",      "state", "monthly"),
    ("SMS25000000000000001", "Massachusetts total nonfarm employment",  "employment_level", "Total Nonfarm", "all", "Massachusetts", "state", "monthly"),
    ("SMS17000000000000001", "Illinois total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Illinois",      "state", "monthly"),
    ("SMS12000000000000001", "Florida total nonfarm employment",        "employment_level", "Total Nonfarm", "all", "Florida",       "state", "monthly"),
    ("SMS51000000000000001", "Virginia total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Virginia",      "state", "monthly"),
    ("SMS08000000000000001", "Colorado total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Colorado",      "state", "monthly"),
    ("SMS41000000000000001", "Oregon total nonfarm employment",         "employment_level", "Total Nonfarm", "all", "Oregon",        "state", "monthly"),
    ("SMS47000000000000001", "Tennessee total nonfarm employment",      "employment_level", "Total Nonfarm", "all", "Tennessee",     "state", "monthly"),
    ("SMS37000000000000001", "North Carolina total nonfarm employment", "employment_level", "Total Nonfarm", "all", "North Carolina","state", "monthly"),
    ("SMS13000000000000001", "Georgia total nonfarm employment",        "employment_level", "Total Nonfarm", "all", "Georgia",       "state", "monthly"),
    ("SMS34000000000000001", "New Jersey total nonfarm employment",     "employment_level", "Total Nonfarm", "all", "New Jersey",    "state", "monthly"),
    ("SMS42000000000000001", "Pennsylvania total nonfarm employment",   "employment_level", "Total Nonfarm", "all", "Pennsylvania",  "state", "monthly"),
    ("SMS39000000000000001", "Ohio total nonfarm employment",           "employment_level", "Total Nonfarm", "all", "Ohio",          "state", "monthly"),
    ("SMS26000000000000001", "Michigan total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Michigan",      "state", "monthly"),
    ("SMS24000000000000001", "Maryland total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Maryland",      "state", "monthly"),
    ("SMS49000000000000001", "Utah total nonfarm employment",           "employment_level", "Total Nonfarm", "all", "Utah",          "state", "monthly"),
    ("SMS32000000000000001", "Nevada total nonfarm employment",         "employment_level", "Total Nonfarm", "all", "Nevada",        "state", "monthly"),
    # Avg weekly earnings for top tech/finance states (data type 13)
    ("SMS06000000000000013", "California avg weekly earnings",          "wage_level",       "Total Nonfarm", "all", "California",    "state", "monthly"),
    ("SMS48000000000000013", "Texas avg weekly earnings",               "wage_level",       "Total Nonfarm", "all", "Texas",         "state", "monthly"),
    ("SMS53000000000000013", "Washington avg weekly earnings",          "wage_level",       "Total Nonfarm", "all", "Washington",    "state", "monthly"),
    ("SMS36000000000000013", "New York avg weekly earnings",            "wage_level",       "Total Nonfarm", "all", "New York",      "state", "monthly"),
    ("SMS25000000000000013", "Massachusetts avg weekly earnings",       "wage_level",       "Total Nonfarm", "all", "Massachusetts", "state", "monthly"),
    ("SMS08000000000000013", "Colorado avg weekly earnings",            "wage_level",       "Total Nonfarm", "all", "Colorado",      "state", "monthly"),
    ("SMS47000000000000013", "Tennessee avg weekly earnings",           "wage_level",       "Total Nonfarm", "all", "Tennessee",     "state", "monthly"),
    ("SMS37000000000000013", "North Carolina avg weekly earnings",      "wage_level",       "Total Nonfarm", "all", "North Carolina","state", "monthly"),
    ("SMS49000000000000013", "Utah avg weekly earnings",                "wage_level",       "Total Nonfarm", "all", "Utah",          "state", "monthly"),
    ("SMS32000000000000013", "Nevada avg weekly earnings",              "wage_level",       "Total Nonfarm", "all", "Nevada",        "state", "monthly"),
]

# Group all series for batched API requests (max 25 per request)
ALL_SERIES = JOLTS_SERIES + CES_SERIES + CPS_SERIES + LAUS_SERIES + SAE_SERIES + METRO_LAUS_SERIES


def _chunk_series(series_list: list, chunk_size: int = 25) -> list[list]:
    """Split series list into API-safe chunks of max 25."""
    return [series_list[i:i + chunk_size] for i in range(0, len(series_list), chunk_size)]


def _build_request_payload(series_ids: list[str], start_year: str, end_year: str) -> dict:
    payload = {
        "seriesid": series_ids,
        "startyear": start_year,
        "endyear": end_year,
        "calculations": True,   # includes net_changes and pct_changes
        "annualaverage": False,
    }
    if BLS_API_KEY:
        payload["registrationkey"] = BLS_API_KEY
    return payload


def _fetch_batch(series_ids: list[str], start_year: str, end_year: str) -> dict:
    """POST one batch to BLS API v2. Returns raw response dict."""
    payload = _build_request_payload(series_ids, start_year, end_year)
    headers = {"Content-type": "application/json"}
    response = requests.post(
        BLS_API_URL,
        data=json.dumps(payload),
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    if data.get("status") != "REQUEST_SUCCEEDED":
        logger.warning(f"BLS API status: {data.get('status')} | message: {data.get('message')}")

    return data


def _build_series_lookup(series_registry: list[tuple]) -> dict:
    """
    Build id → metadata lookup. Handles two tuple formats:
      6-field (JOLTS/CES/CPS): (id, label, signal_type, industry, naics, cadence)
      8-field (LAUS/SAE):      (id, label, signal_type, industry, naics, geo, geo_type, cadence)
    """
    lookup = {}
    for s in series_registry:
        if len(s) == 8:
            lookup[s[0]] = {
                "label":        s[1],
                "signal_type":  s[2],
                "industry":     s[3],
                "naics_or_noc": s[4],
                "geo":          s[5],
                "geo_type":     s[6],
                "cadence":      s[7],
            }
        else:
            # 6-field — national series, default geo
            lookup[s[0]] = {
                "label":        s[1],
                "signal_type":  s[2],
                "industry":     s[3],
                "naics_or_noc": s[4],
                "geo":          "national",
                "geo_type":     "national",
                "cadence":      s[5],
            }
    return lookup


def _extract_latest_periods(series_data: dict, n_periods: int = 13) -> list[dict]:
    """
    Extract the latest N data points from a BLS series response object.
    Returns list of {period, value, footnotes} sorted newest first.
    BLS returns data newest-first already, but we sort to be safe.
    """
    data_points = series_data.get("data", [])
    # Sort by year desc, period desc (M12 > M01 etc.)
    sorted_points = sorted(
        data_points,
        key=lambda x: (x.get("year", "0"), x.get("period", "M00")),
        reverse=True,
    )
    results = []
    for point in sorted_points[:n_periods]:
        value = point.get("value", "-")
        if value == "-":
            continue
        results.append({
            "period":     f"{point['year']}-{point['period'].replace('M', '')}",
            "value":      float(value),
            "footnotes":  [f.get("text", "") for f in point.get("footnotes", []) if f.get("text")],
        })
    return results


def fetch_bls(
    lookback_years: int = 2,
    series_override: Optional[list[tuple]] = None,
) -> list[dict]:
    """
    Main entry point. Fetches all BLS series and returns a list of
    normalized intermediate dicts ready for transformer.py.

    Args:
        lookback_years: How many years of history to fetch (default 2).
        series_override: Optionally pass a subset of series tuples for testing.

    Returns:
        List of normalized dicts, one per series with latest 13 months of data.
    """
    series_to_fetch = series_override or ALL_SERIES
    lookup = _build_series_lookup(series_to_fetch)

    end_year   = str(datetime.now().year)
    start_year = str(datetime.now().year - lookback_years)

    series_ids = [s[0] for s in series_to_fetch]
    chunks     = _chunk_series(series_ids, chunk_size=25)

    # Map series_id → raw BLS series response
    raw_by_id: dict[str, dict] = {}
    for i, chunk in enumerate(chunks):
        logger.info(f"Fetching BLS batch {i+1}/{len(chunks)} ({len(chunk)} series)")
        try:
            response = _fetch_batch(chunk, start_year, end_year)
            for series in response.get("Results", {}).get("series", []):
                raw_by_id[series["seriesID"]] = series
        except requests.RequestException as e:
            logger.error(f"BLS batch {i+1} failed: {e}")
            # Continue — partial results are still useful
            continue

    # Build normalized output dicts
    normalized: list[dict] = []
    for series_id, meta in lookup.items():
        raw = raw_by_id.get(series_id)
        if not raw:
            logger.warning(f"No data returned for series {series_id}")
            continue

        periods = _extract_latest_periods(raw, n_periods=13)
        if not periods:
            logger.warning(f"Empty data for series {series_id}")
            continue

        latest   = periods[0]
        previous = periods[1] if len(periods) > 1 else None
        # 12-month average
        avg_12mo = round(
            sum(p["value"] for p in periods[:12]) / min(len(periods), 12), 2
        ) if periods else None

        normalized.append({
            # Identity
            "series_id":    series_id,
            "source":       _resolve_source(series_id),
            "country":      "US",
            "country_name": "United States",
            # Classification
            "signal_type":  meta["signal_type"],
            "industry":     meta["industry"],
            "naics_or_noc": meta["naics_or_noc"],
            "geo":          meta["geo"],
            "geo_type":     meta["geo_type"],
            "cadence":      meta["cadence"],
            # Time
            "period":       latest["period"],
            # Values for transformer to use in prose generation
            "values": {
                "latest":           latest["value"],
                "previous":         previous["value"] if previous else None,
                "mom_change":       round(latest["value"] - previous["value"], 3) if previous else None,
                "avg_12mo":         avg_12mo,
                "trend_direction":  _trend(latest["value"], avg_12mo),
                "periods_history":  periods,  # full 13-month history
            },
            # Passthrough label for transformer
            "series_label": meta["label"],
        })

    logger.info(f"BLS fetch complete: {len(normalized)} series normalized")
    return normalized


def _resolve_source(series_id: str) -> str:
    """Map series prefix to human-readable source name."""
    prefix_map = {
        "JTS": "BLS_JOLTS",
        "JTU": "BLS_JOLTS",
        "CES": "BLS_CES",
        "LNS": "BLS_CPS",
        "LNU": "BLS_CPS",
        "LAS": "BLS_LAUS",
        "LAU": "BLS_LAUS",  # metro-area LAUS series (LAUMT...), distinct prefix from state LASST...
        "SMS": "BLS_SAE",
        "SMU": "BLS_SAE",
    }
    for prefix, source in prefix_map.items():
        if series_id.startswith(prefix):
            return source
    return "BLS_UNKNOWN"


def _trend(latest: float, avg_12mo: Optional[float]) -> str:
    """Simple trend label for transformer context."""
    if avg_12mo is None:
        return "unknown"
    diff = latest - avg_12mo
    if diff > avg_12mo * 0.10:
        return "significantly_elevated"
    elif diff > avg_12mo * 0.03:
        return "elevated"
    elif diff < -avg_12mo * 0.10:
        return "significantly_below"
    elif diff < -avg_12mo * 0.03:
        return "below"
    else:
        return "near_average"


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Quick test — fetch just 3 series to verify connectivity
    test_series = JOLTS_SERIES[:3]
    results = fetch_bls(lookback_years=1, series_override=test_series)
    for r in results:
        print(json.dumps({k: v for k, v in r.items() if k != "values"}, indent=2))
        print(f"  latest: {r['values']['latest']}, avg_12mo: {r['values']['avg_12mo']}, trend: {r['values']['trend_direction']}")
        print()