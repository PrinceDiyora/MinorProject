import { getRecommendations } from "../services/recommendation.service.js";
import { ApiError }           from "../utils/ApiError.js";
import { ApiResponse }        from "../utils/ApiResponse.js";
import { asyncHandler }       from "../utils/asyncHandler.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/recommendations
//
// Body (JSON):
// {
//   "cart"      : [1, 3],   ← food_ids in the cart (required)
//   "threshold" : 5,        ← min weighted score   (optional, default 5)
//   "limit"     : 3         ← max results          (optional, default 3)
// }
//
// GET /api/recommendations?cart=1,3&threshold=5&limit=3
// Requires: valid JWT (sets req.admin for tenant scoping)
// ─────────────────────────────────────────────────────────────────────────────
const recommend = asyncHandler(async (req, res) => {
  // Accept cart from body (POST) or query-string (GET)
  let rawCart   = req.body?.cart      ?? req.query?.cart;
  let threshold = req.body?.threshold ?? req.query?.threshold;
  let limit     = req.body?.limit     ?? req.query?.limit;

  // ── Parse cart ──────────────────────────────────────────────────────────────
  // POST body: array of numbers → [1, 3]
  // GET query: comma-separated  → "1,3"
  if (typeof rawCart === "string") {
    rawCart = rawCart.split(",").map((s) => parseInt(s.trim(), 10));
  }

  if (!Array.isArray(rawCart) || rawCart.length === 0) {
    throw new ApiError(400, "cart must be a non-empty array of food_ids");
  }

  const cartFoodIds = rawCart.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (cartFoodIds.length === 0) {
    throw new ApiError(400, "cart contains no valid food_ids");
  }

  threshold = threshold !== undefined ? parseInt(threshold, 10) : 5;
  limit     = limit     ? parseInt(limit,     10) : 3;

  if (isNaN(threshold) || threshold < 0) threshold = 5;
  if (isNaN(limit)     || limit     < 1) limit     = 3;

  // ── Run engine (adminId scopes results to this restaurant) ─────────────────
  const suggestions = await getRecommendations({
    cartFoodIds,
    adminId:   req.admin.id,
    threshold,
    topN:      limit,
  });

  return res.status(200).json(
    new ApiResponse(200, {
      cart:        cartFoodIds,
      threshold,
      limit,
      suggestions,
    }, "Recommendations fetched successfully")
  );
});

export { recommend };
