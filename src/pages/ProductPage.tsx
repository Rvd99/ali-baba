import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { productsApi, cartApi, type Product, type Review } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMsg, setCartMsg] = useState("");

  // Review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    productsApi.getById(id)
      .then((res) => setProduct(res.data))
      .catch(() => setError("Failed to load product."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    setAddingToCart(true);
    setCartMsg("");
    try {
      await cartApi.addItem(product!.id, quantity);
      setCartMsg("Added to cart!");
      setTimeout(() => setCartMsg(""), 3000);
    } catch {
      setCartMsg("Failed to add to cart.");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    setAddingToCart(true);
    try {
      await cartApi.addItem(product!.id, quantity);
      navigate("/cart");
    } catch {
      setCartMsg("Failed to add to cart.");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) { navigate("/login"); return; }
    setSubmittingReview(true);
    try {
      await api.post("/reviews", { productId: product!.id, rating: reviewRating, comment: reviewComment || null });
      // Re-fetch product to get updated reviews
      const res = await productsApi.getById(product!.id);
      setProduct(res.data);
      setReviewComment("");
      setReviewRating(5);
    } catch {
      // silently fail or show error
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="aspect-square bg-gray-200 rounded-lg" />
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-12 bg-gray-200 rounded w-1/3" />
                <div className="h-20 bg-gray-200 rounded" />
                <div className="h-12 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{error || "Product not found"}</h2>
          <Link to="/" className="text-orange-500 hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  const reviews: Review[] = product.reviews || [];
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const discount = product.compareAt ? Math.round((1 - product.price / product.compareAt) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex gap-2">
          <Link to="/" className="hover:text-orange-500">Home</Link>
          <span>/</span>
          {product.category && (
            <>
              <Link to={`/?category=${product.category.slug}`} className="hover:text-orange-500">
                {product.category.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900">{product.name}</span>
        </nav>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            {/* Images */}
            <div>
              <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden mb-4">
                {product.images.length > 0 ? (
                  <img
                    src={product.images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-6xl">📦</div>
                )}
              </div>
              {product.images.length > 1 && (
                <div className="flex gap-3">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                        idx === selectedImage ? "border-orange-500" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex text-yellow-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={star <= Math.round(avgRating) ? "text-yellow-400" : "text-gray-300"}>★</span>
                  ))}
                </div>
                <span className="text-sm text-gray-500">
                  {avgRating > 0 ? `${avgRating.toFixed(1)} (${reviews.length} reviews)` : "No reviews yet"}
                </span>
                <span className="text-sm text-gray-400">|</span>
                <span className={`text-sm font-medium ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}>
                  {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </span>
              </div>

              <div className="bg-orange-50 rounded-lg p-4 mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-orange-600">
                    ${product.price.toFixed(2)}
                  </span>
                  {product.compareAt && (
                    <>
                      <span className="text-sm text-gray-500 line-through">
                        ${product.compareAt.toFixed(2)}
                      </span>
                      {discount && (
                        <span className="text-sm bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">
                          -{discount}%
                        </span>
                      )}
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">Min. order: {product.minOrder} piece{product.minOrder > 1 ? "s" : ""}</p>
              </div>

              <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>

              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {product.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{tag}</span>
                  ))}
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center gap-4 mb-6">
                <label className="text-sm font-medium text-gray-700">Quantity:</label>
                <div className="flex items-center border rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(product.minOrder, quantity - 1))}
                    className="px-3 py-2 text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 border-x font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="px-3 py-2 text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || product.stock === 0}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  {addingToCart ? "Adding..." : "Add to Cart"}
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={addingToCart || product.stock === 0}
                  className="flex-1 border-2 border-orange-500 text-orange-500 hover:bg-orange-50 disabled:border-gray-300 disabled:text-gray-400 font-semibold py-3 rounded-lg transition-colors"
                >
                  Buy Now
                </button>
              </div>
              {cartMsg && (
                <p className={`text-sm mt-2 ${cartMsg.includes("Failed") ? "text-red-600" : "text-green-600"}`}>
                  {cartMsg}
                </p>
              )}

              {/* Seller Info */}
              {product.seller && (
                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {product.seller.avatar ? (
                      <img src={product.seller.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">
                        {product.seller.name?.charAt(0).toUpperCase() || "S"}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{product.seller.name}</p>
                      {product.seller.company && (
                        <p className="text-sm text-gray-500">{product.seller.company}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Customer Reviews ({reviews.length})
          </h2>

          {/* Review Form */}
          {isAuthenticated && (
            <form onSubmit={handleSubmitReview} className="mb-8 border-b border-gray-100 pb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Write a Review</h3>
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className={`text-2xl ${star <= reviewRating ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-400 transition-colors`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience with this product..."
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
                rows={3}
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors"
              >
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </form>
          )}

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="flex gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold flex-shrink-0">
                    {review.user?.avatar ? (
                      <img src={review.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      review.user?.name?.charAt(0).toUpperCase() || "U"
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">{review.user?.name || "User"}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex text-yellow-400 text-sm mb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={star <= review.rating ? "text-yellow-400" : "text-gray-300"}>★</span>
                      ))}
                    </div>
                    {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No reviews yet. Be the first to review this product!</p>
          )}
        </div>
      </div>
    </div>
  );
}
