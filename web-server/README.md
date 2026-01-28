# Redis initial implementation

Build cacheKey from location

-> redis.get(cacheKey)

If exists -> return parsed JSON

Else:

-> Run RAG Processes

Merge result

redis.set(cacheKey, result, TTL)

Return result

# Redis for Queue

Request -> Express -> enqueue job -> accept(202) Worker -> Redis queue -> generateMarketInsights -> store result -> client polls