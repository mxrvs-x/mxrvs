import Constants from "expo-constants";

import { readJsonResponse } from "@/lib/fetchJson";

const FATSECRET_REST_BASE = "https://platform.fatsecret.com/rest";

type FatSecretExtra = {
  fatSecretOAuth1RestApiConsumerKey?: string;
  fatSecretOAuth1RestApiConsumerSecret?: string;
};

export type FatSecretServing = {
  serving_id?: string;
  serving_description?: string;
  serving_url?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  number_of_units?: string;
  measurement_description?: string;
  is_default?: string;
  calories?: string;
  carbohydrate?: string;
  protein?: string;
  fat?: string;
  saturated_fat?: string;
  polyunsaturated_fat?: string;
  monounsaturated_fat?: string;
  trans_fat?: string;
  cholesterol?: string;
  sodium?: string;
  potassium?: string;
  fiber?: string;
  sugar?: string;
  added_sugars?: string;
  vitamin_a?: string;
  vitamin_c?: string;
  vitamin_d?: string;
  calcium?: string;
  iron?: string;
};

export type FatSecretFood = {
  food_id: string;
  food_name: string;
  food_type?: string;
  food_url?: string;
  brand_name?: string;
  food_description?: string;
  servings?: {
    serving?: FatSecretServing | FatSecretServing[];
  };
};

export type FatSecretSearchFood = FatSecretFood;

type FatSecretSearchResponse = {
  foods?: {
    max_results?: string | number;
    total_results?: string | number;
    page_number?: string | number;
    food?: FatSecretSearchFood | FatSecretSearchFood[];
  };
  foods_search?: {
    max_results?: string | number;
    total_results?: string | number;
    page_number?: string | number;
    results?: {
      food?: FatSecretSearchFood | FatSecretSearchFood[];
    };
  };
};

type FatSecretFoodResponse = {
  food?: FatSecretFood;
};

type FatSecretLocalization = {
  region?: string | "all";
  language?: string;
};

const DEFAULT_LOCALIZATION: FatSecretLocalization = {
  region: "all",
  language: "en",
};

const FATSECRET_REGION_CODES = [
  "AF", "AL", "DZ", "AS", "AD", "AO", "AG", "AR", "AM", "AW", "AU", "AT",
  "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO",
  "BA", "BW", "BR", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY",
  "CF", "TD", "CL", "CN", "CO", "KM", "CG", "CR", "HR", "CU", "CY", "CZ",
  "CD", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ",
  "ET", "FO", "FJ", "FI", "FR", "GF", "PF", "GA", "GM", "GE", "DE", "GH",
  "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HN",
  "HK", "HU", "IS", "IN", "ID", "IE", "IM", "IL", "IT", "CI", "JM", "JP",
  "JE", "JO", "KZ", "KE", "KI", "KR", "KW", "KG", "LA", "LV", "LB", "LS",
  "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT",
  "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MA",
  "MZ", "MM", "NA", "NP", "NL", "AN", "NC", "NZ", "NI", "NE", "NG", "MK",
  "MP", "NO", "OM", "PK", "PA", "PG", "PY", "PE", "PH", "PL", "PT", "PR",
  "QA", "RE", "RO", "RU", "RW", "KN", "LC", "MF", "VC", "WS", "SM", "ST",
  "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB", "SO", "ZA", "ES",
  "LK", "SR", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TO",
  "TT", "TN", "TR", "TM", "TC", "UG", "UA", "AE", "GB", "US", "UY", "UZ",
  "VU", "VE", "VN", "VI", "EH", "YE", "ZM", "ZW",
];

const PRIORITY_REGION_CODES = [
  "PH", "US", "GB", "AU", "CA", "SG", "MY", "ID", "TH", "HK", "JP", "KR",
  "IN", "AE", "SA", "NZ", "IE", "ZA", "MX", "BR", "ES", "FR", "DE", "IT",
  "NL",
];

const ALL_SEARCH_REGION_CODES = [
  ...PRIORITY_REGION_CODES,
  ...FATSECRET_REGION_CODES.filter(
    (region) => !PRIORITY_REGION_CODES.includes(region),
  ),
];

const REGION_SEARCH_CHUNK_SIZE = 10;
const RESULTS_PER_REGION = 10;
const ALL_REGION_SEARCH_TIME_BUDGET_MS = 6500;
const REGION_REQUEST_TIMEOUT_MS = 4500;

function getExtra() {
  return (Constants.expoConfig?.extra ?? {}) as FatSecretExtra;
}

function getOAuth1Credentials() {
  const extra = getExtra();
  const consumerKey = (
    process.env.FATSECRET_OAUTH1_REST_API_CONSUMER_KEY ??
    extra.fatSecretOAuth1RestApiConsumerKey ??
    ""
  ).trim();
  const consumerSecret = (
    process.env.FATSECRET_OAUTH1_REST_API_CONSUMER_SECRET ??
    extra.fatSecretOAuth1RestApiConsumerSecret ??
    ""
  ).trim();

  if (!consumerKey || !consumerSecret) {
    throw new Error(
      "Missing FATSECRET_OAUTH1_REST_API_CONSUMER_KEY or FATSECRET_OAUTH1_REST_API_CONSUMER_SECRET in .env",
    );
  }

  return { consumerKey, consumerSecret };
}

export function getFatSecretCredentialIssue() {
  const extra = getExtra();
  const consumerKey = (
    process.env.FATSECRET_OAUTH1_REST_API_CONSUMER_KEY ??
    extra.fatSecretOAuth1RestApiConsumerKey ??
    ""
  ).trim();
  const consumerSecret = (
    process.env.FATSECRET_OAUTH1_REST_API_CONSUMER_SECRET ??
    extra.fatSecretOAuth1RestApiConsumerSecret ??
    ""
  ).trim();

  if (!consumerKey) {
    return "Missing FATSECRET_OAUTH1_REST_API_CONSUMER_KEY in .env";
  }

  if (!consumerSecret) {
    return "Missing FATSECRET_OAUTH1_REST_API_CONSUMER_SECRET in .env";
  }

  return null;
}

export function hasFatSecretCredentials() {
  return !getFatSecretCredentialIssue();
}

function toArray<T>(value?: T | T[]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getSearchFoods(json: FatSecretSearchResponse) {
  return toArray(
    json.foods?.food ??
      json.foods_search?.results?.food,
  );
}

export function getFatSecretServings(food?: FatSecretFood | FatSecretSearchFood) {
  return toArray(food?.servings?.serving);
}

export function getFatSecretDefaultServing(
  food?: FatSecretFood | FatSecretSearchFood,
) {
  const servings = getFatSecretServings(food);

  return (
    servings.find((serving) => String(serving.is_default) === "1") ??
    servings.find((serving) => serving.metric_serving_unit === "g") ??
    servings[0] ??
    null
  );
}

export function compactFatSecretFoodPayload(food: FatSecretFood) {
  return {
    resultType: "fatsecret",
    food_id: food.food_id,
    food_name: food.food_name,
    food_type: food.food_type,
    food_url: food.food_url,
    brand_name: food.brand_name,
    food_description: food.food_description,
    servings: food.servings,
  };
}

export const compactFatSecretDetailedFoodPayload = compactFatSecretFoodPayload;

function encode(value: string | number) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function randomNonce() {
  return `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

function utf8Bytes(value: string) {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    let code = value.charCodeAt(index);

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      index += 1;
      code =
        0x10000 +
        (((code & 0x3ff) << 10) | (value.charCodeAt(index) & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }

  return bytes;
}

function rotateLeft(value: number, bits: number) {
  return (value << bits) | (value >>> (32 - bits));
}

function sha1(bytes: number[]) {
  const words: number[] = [];
  const bitLength = bytes.length * 8;

  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] |= bytes[index] << (24 - (index % 4) * 8);
  }

  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let block = 0; block < words.length; block += 16) {
    const w = new Array<number>(80);

    for (let index = 0; index < 16; index += 1) {
      w[index] = words[block + index] | 0;
    }

    for (let index = 16; index < 80; index += 1) {
      w[index] = rotateLeft(
        w[index - 3] ^ w[index - 8] ^ w[index - 14] ^ w[index - 16],
        1,
      );
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let index = 0; index < 80; index += 1) {
      let f: number;
      let k: number;

      if (index < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (rotateLeft(a, 5) + f + e + k + w[index]) | 0;

      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const digest: number[] = [];

  [h0, h1, h2, h3, h4].forEach((word) => {
    digest.push(
      (word >>> 24) & 0xff,
      (word >>> 16) & 0xff,
      (word >>> 8) & 0xff,
      word & 0xff,
    );
  });

  return digest;
}

function hmacSha1(key: string, message: string) {
  let keyBytes = utf8Bytes(key);

  if (keyBytes.length > 64) {
    keyBytes = sha1(keyBytes);
  }

  while (keyBytes.length < 64) {
    keyBytes.push(0);
  }

  const outer = keyBytes.map((byte) => byte ^ 0x5c);
  const inner = keyBytes.map((byte) => byte ^ 0x36);

  return sha1([...outer, ...sha1([...inner, ...utf8Bytes(message)])]);
}

function base64(bytes: number[]) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const triplet = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    output += chars[(triplet >> 18) & 0x3f];
    output += chars[(triplet >> 12) & 0x3f];
    output += index + 1 < bytes.length ? chars[(triplet >> 6) & 0x3f] : "=";
    output += index + 2 < bytes.length ? chars[triplet & 0x3f] : "=";
  }

  return output;
}

function localizationParams(localization = DEFAULT_LOCALIZATION) {
  const region = localization.region?.trim();

  if (!region || region.toLowerCase() === "all") {
    return {};
  }

  return {
    region,
    language: localization.language?.trim() || "en",
  };
}

function buildSignedUrl(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  const { consumerKey, consumerSecret } = getOAuth1Credentials();
  const url = `${FATSECRET_REST_BASE}${path}`;
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };
  const queryParams = {
    ...params,
    format: "json",
    ...oauthParams,
  };
  const normalized = Object.entries(queryParams)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [encode(key), encode(String(value))])
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const signatureBase = `GET&${encode(url)}&${encode(normalized)}`;
  const signingKey = `${encode(consumerSecret)}&`;
  const signature = base64(hmacSha1(signingKey, signatureBase));
  const searchParams = new URLSearchParams();

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined) searchParams.append(key, String(value));
  });

  searchParams.append("oauth_signature", signature);

  return `${url}?${searchParams.toString()}`;
}

async function fatSecretGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  label: string,
) {
  const response = await fetch(buildSignedUrl(path, params), {
    headers: {
      Accept: "application/json",
    },
  });
  const json = await readJsonResponse<T>(response, label);

  if (!response.ok) {
    throw new Error(JSON.stringify(json));
  }

  return json;
}

async function searchFatSecretFoodsForRegion({
  query,
  maxResults = 50,
  pageNumber = 0,
  localization,
}: {
  query: string;
  maxResults?: number;
  pageNumber?: number;
  localization?: FatSecretLocalization;
}) {
  const json = await fatSecretGet<FatSecretSearchResponse>(
    "/server.api",
    {
      method: "foods.search",
      search_expression: query,
      max_results: maxResults,
      page_number: pageNumber,
      ...localizationParams(localization),
    },
    "FatSecret food search",
  );

  return getSearchFoods(json);
}

async function searchFatSecretFoodsForRegionSafely(
  params: Parameters<typeof searchFatSecretFoodsForRegion>[0],
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<FatSecretSearchFood[]>((resolve) => {
    timeout = setTimeout(() => resolve([]), REGION_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      searchFatSecretFoodsForRegion(params),
      timeoutPromise,
    ]);
  } catch (error) {
    console.log("FatSecret region search skipped:", error);
    return [];
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function searchFatSecretFoods(
  searchExpression: string,
  localization = DEFAULT_LOCALIZATION,
  limit = 50,
) {
  const query = searchExpression.trim();

  if (query.length < 2) return [];

  if (localization.region?.toLowerCase() !== "all") {
    return searchFatSecretFoodsForRegion({
      query,
      maxResults: 50,
      localization,
    });
  }

  const allResults: FatSecretSearchFood[] = [];
  const seen = new Set<string>();
  let defaultSearchError: unknown = null;
  const addUniqueResults = (foods: FatSecretSearchFood[]) => {
    foods.forEach((food) => {
      if (!food.food_id || seen.has(food.food_id)) return;

      seen.add(food.food_id);
      allResults.push(food);
    });
  };
  const startedAt = Date.now();

  for (
    let index = 0;
    index < ALL_SEARCH_REGION_CODES.length;
    index += REGION_SEARCH_CHUNK_SIZE
  ) {
    if (
      allResults.length >= limit ||
      Date.now() - startedAt >= ALL_REGION_SEARCH_TIME_BUDGET_MS
    ) {
      break;
    }

    const regions = ALL_SEARCH_REGION_CODES.slice(
      index,
      index + REGION_SEARCH_CHUNK_SIZE,
    );
    const settled = await Promise.allSettled(
      regions.map((region) =>
        searchFatSecretFoodsForRegionSafely({
          query,
          maxResults: RESULTS_PER_REGION,
          localization: {
            region,
            language: localization.language ?? "en",
          },
        }),
      ),
    );

    settled.forEach((result) => {
      if (result.status !== "fulfilled") return;

      addUniqueResults(result.value);
    });
  }

  if (allResults.length < limit) {
    try {
      addUniqueResults(
        await searchFatSecretFoodsForRegion({
          query,
          maxResults: Math.min(limit - allResults.length, 50),
        }),
      );
    } catch (error) {
      defaultSearchError = error;
      console.log("FatSecret default search skipped:", error);
    }
  }

  if (allResults.length === 0 && defaultSearchError) {
    throw defaultSearchError;
  }

  return allResults.slice(0, limit);
}

export async function searchFatSecretFoodsWithDetails(
  searchExpression: string,
  limit = 20,
  localization?: FatSecretLocalization,
) {
  const results = await searchFatSecretFoods(
    searchExpression,
    localization,
    limit,
  );

  return results.slice(0, limit);
}

export async function getFatSecretFood(foodId: string) {
  const json = await fatSecretGet<FatSecretFoodResponse>(
    "/server.api",
    {
      method: "food.get",
      food_id: foodId,
      flag_default_serving: true,
    },
    "FatSecret food detail",
  );

  if (!json.food) {
    throw new Error("FatSecret did not return a food for this id.");
  }

  return json.food;
}
