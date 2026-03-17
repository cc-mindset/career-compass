import { City } from "country-state-city";

const ALLOWED_COUNTRIES = ["CA", "US", "GB"]; //Uk is GB.
export interface LocationOption {
  label: string;
  value: string;
  city: string;
  state?: string;
  country: string;
}

export const buildLocations = (): LocationOption[] => {
  return ALLOWED_COUNTRIES.flatMap((countryCode) =>
    (City.getCitiesOfCountry(countryCode) ?? [])
      .filter((city) => {
        const name = city.name.toLowerCase();
        return (
          !name.includes("county") &&
          !name.includes("parish") &&
          !name.includes("borough") &&
    !name.includes("province") &&
    !name.includes("region") &&
    city.stateCode !== undefined && // must have a state/province code = it's a city
    city.name !== city.stateCode    // name shouldn't equal its own state code
        );
      })
      .map((city) => ({
        label: `${city.name}, ${city.stateCode || city.countryCode}`,
        value: city.name,
        city: city.name,
        state: city.stateCode,
        country: city.countryCode
      }))
  );
};