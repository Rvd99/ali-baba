import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { wishlistApi, cartApi, type WishlistItemResponse } from "../lib/api";

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  useEffect(() => {
    wishlistApi.get()
      .then((res) => setItems(res.data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (productId: string) => {
    setRemoving(productId);
    try {
      await wishlistApi.removeItem(productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch { /* ignore */ }
    setRemoving(null);
  };

  const handleAddToCart = async (productId: string) => {
    setAddingToCart(productId);
    try {
      await cartApi.addItem(productId, 1);
      // Optionally remove from wishlist after adding to cart
      await wishlistApi.removeItem(productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch { /* ignore */ }
    setAddingToCart(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Wishlist</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-5 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          My Wishlist ({items.length})
        </h1>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${
                  removing === item.productId ? "opacity-50" : ""
                }`}
              >
                <Link to={`/products/${item.productId}`}>
                  <div className="aspect-square bg-gray-50">
                    {item.product?.images?.[0] ? (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name || "Product"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                        📦
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link
                    to={`/products/${item.productId}`}
                    className="font-medium text-gray-900 text-sm hover:text-orange-500 line-clamp-2"
                  >
                    {item.product?.name || "Product"}
                  </Link>
                  <p className="text-orange-600 font-bold mt-1">
                    ${(item.product?.price || 0).toFixed(2)}
                  </p>
                  <p className={`text-xs mt-1 ${item.product && item.product.stock > 0 ? "text-green-600" : "text-red-500"}`}>
                    {item.product && item.product.stock > 0 ? `${item.product.stock} in stock` : "Out of stock"}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleAddToCart(item.productId)}
                      disabled={addingToCart === item.productId || !item.product || item.product.stock === 0}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                    >
                      {addingToCart === item.productId ? "Adding..." : "Add to Cart"}
                    </button>
                    <button
                      onClick={() => handleRemove(item.productId)}
                      disabled={removing === item.productId}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors"
                      title="Remove from wishlist"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-6xl mb-4">❤️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Your wishlist is empty</h3>
            <p className="text-gray-500 mb-6">Save products you love for later</p>
            <Link
              to="/"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Browse Products
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
