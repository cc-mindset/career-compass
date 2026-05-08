import citiesJson from 'cities.json' with { type: 'json' }

interface City {
    name: string;
    lat: string;
    lng: string;
    country: string;
    admin1: string;
    admin2: string;

}

const cities: City[] = citiesJson as City[];

const cityNameSet = new Set(cities.map((c) => c.name.toLocaleLowerCase()));

const topCityCandidates = ["New York City", "Los Angeles", "Chicago", "Texas City", "Houston", "Phoenix",
    "San Antonio", "Philadelphia", "San Diego", "Dallas", "Fort Worth",
    "Jacksonville", "Austin", "San Jose", "Charlotte", "Columbus",
    "Indianapolis", "San Francisco", "Seattle", "Denver", "Oklahoma City",
    "Washington", "Nashville", "El Paso", "Las Vegas", "Boston",
    "Detroit", "Louisville", "Portland", "Memphis", "Baltimore",
    "Tucson", "Albuquerque", "Milwaukee", "Fresno", "Sacramento",
    "Mesa", "Atlanta", "Kansas City", "Colorado Springs", "Omaha",
    "Raleigh", "Miami", "Virginia Beach", "Oakland", "Minneapolis",
    "Tulsa", "Bakersfield", "Wichita", "Arlington", "Aurora", "Toronto", "Montreal", "Calgary", "Ottawa", "Edmonton",
    "Winnipeg", "Mississauga", "Vancouver", "Brampton", "Hamilton",
    "Surrey", "Quebec City", "Halifax", "Laval", "London",
    "Markham", "Vaughan", "Gatineau", "Saskatoon", "Kitchener",
    "Longueuil", "Burnaby", "Windsor", "Regina", "Oakville",
    "Richmond", "Richmond Hill", "Burlington", "Oshawa", "Sherbrooke",
    "Greater Sudbury", "Abbotsford", "Lévis", "Coquitlam", "Barrie",
    "Saguenay", "Kelowna", "Guelph", "Trois-Rivières", "Whitby",
    "Cambridge", "St. Catharines", "Milton", "Langley", "Kingston",
    "Ajax", "Waterloo", "Terrebonne", "Saanich", "St. John's", "Ontario"];

const topCities = topCityCandidates.filter((city) => cityNameSet.has(city.toLocaleLowerCase()));
const topCitiesSet = new Set(topCities.map((city) => city.toLocaleLowerCase()));

const findCityData = (city: string, state: string) =>
    cities.find((c) => c.name.toLocaleLowerCase() === city.toLocaleLowerCase() && c.admin1.toLocaleLowerCase() === state.toLocaleLowerCase());

export const getDistrictOfACity = (cityState: string) => {
    const [city, state] = cityState.split(", ");
    let cityData = cities.find((c) => c.name.toLocaleLowerCase() === city.toLocaleLowerCase() && c.admin1.toLocaleLowerCase() === state.toLocaleLowerCase());
    if (cityData)
        return cityData.admin2;
    return null; // fallback to null if no match found
}


export const getTopCityOfDistrictOfACity = (cityState: string) => {
    let locationCity = cityState; // default to input if no better match found
    let locationDistrict = "";
    const [city, state] = cityState.split(", ");
    const cityData = findCityData(city, state);
    if (cityData && topCitiesSet.has(cityData.name.toLocaleLowerCase())) {
        locationCity = `${cityData.name}, ${cityData.admin1}`;
        locationDistrict = cityData.admin2;

        return { locationCity, locationDistrict };
    }

    const district = getDistrictOfACity(cityState);
    if (district) {
        const districtCity = cities.find((c) => c.admin2.toLocaleLowerCase() === district.toLocaleLowerCase() && c.admin1.toLocaleLowerCase() === state.toLocaleLowerCase());
        if (districtCity) {
            locationCity = `${districtCity.name}, ${districtCity.admin1}`;
            locationDistrict = districtCity.admin2;

            return { locationCity, locationDistrict };
        }
    }

    return { locationCity, locationDistrict };

}

export const getTopCitiesOfState = (state: string) => {
    let result: string[] = [];
    //getting all districts of the state
    const allDistrictCities = cities.filter((c) => c.admin1.toLocaleLowerCase() === state.toLocaleLowerCase()).map((c) => c.admin2);
    let districts: string[] = [];
    allDistrictCities.forEach((district) => {
        if (!districts.includes(district)) {
            districts.push(district);
        }
    });

    //getting districts of top cities in the given state, limited to names present in the JSON data
    const topCitiesDistricts = topCities.map((city) => {
        const cityData = findCityData(city, state);
        if (cityData) return cityData.admin2;
        return null;
    }).filter((d): d is string => !!d);

    //removing districts of top cities from all districts of the state
    districts = districts.filter((d) => !topCitiesDistricts.includes(d));

    // If there are districts, get the top city of each district and add to result
    if (districts.length > 0) {
        const topCitiesOfState = districts.map((district) => {
            const cityData = cities.find((c) => c.admin2.toLocaleLowerCase() === district.toLocaleLowerCase() && c.admin1.toLocaleLowerCase() === state.toLocaleLowerCase());
            return cityData;
        }).filter((c): c is City => !!c);
        result = topCitiesOfState.map((c) => `${c.name}, ${c.admin1}`);
    }

    // Finally, add the hardcoded top cities of the state to the result
    result = result.concat(topCities.filter((city) => {
        let cityData = cities.find((c) => c.name.toLocaleLowerCase() === city.toLocaleLowerCase() && c.admin1.toLocaleLowerCase() === state.toLocaleLowerCase());
        return !!cityData;
    }).map((city) => {
        let cityData = cities.find((c) => c.name.toLocaleLowerCase() === city.toLocaleLowerCase() && c.admin1.toLocaleLowerCase() === state.toLocaleLowerCase());
        if (cityData) return `${cityData.name}, ${cityData.admin1}`;
        return null;
    }).filter((c): c is string => !!c));
    return result
}