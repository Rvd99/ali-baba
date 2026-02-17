import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cartApi, type CartItemResponse } from "../lib/api";

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchCart = async () => {
    try {
      const res = await cartApi.get();
      setItems(res.data.items || []);
    } catch {
      setError("Failed to load cart.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCart(); }, []);

  const updateQuantity = async (productId: string, newQty: number) => {
    setUpdating(productId);
    try {
      await cartApi.updateItem(productId, newQty);
      await fetchCart();
    } catch { /* ignore */ }
    setUpdating(null);
  };

  const removeItem = async (productId: string) => {
    setUpdating(productId);
    try {
      await cartApi.removeItem(productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch { /* ignore */ }
    setUpdating(null);
  };

  const total = items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping Cart</h1>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-4 animate-pulse">
                <div className="w-24 h-24 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-8 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => { setError(null); setLoading(true); fetchCart(); }} className="text-orange-500 hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping Cart</h1>

        {items.length > 0 ? (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Cart Items */}
            <div className="flex-1 space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-4 ${updating === item.productId ? "opacity-60" : ""}`}
                >
                  <Link to={`/products/${item.productId}`}>
                    <img
                      src={item.product?.images?.[0] || "https://placehold.co/100x100/e8e8e8/999?text=No+Image"}
                      alt={item.product?.name || "Product"}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  </Link>
                  <div className="flex-1">
                    <Link to={`/products/${item.productId}`} className="font-medium text-gray-900 hover:text-orange-500">
                      {item.product?.name || "Product"}
                    </Link>
                    <p className="text-orange-600 font-bold mt-1">
                      ${(item.product?.price || 0).toFixed(2)}
                    </p>
                    {item.product && item.product.stock < item.quantity && (
                      <p className="text-xs text-red-500 mt-1">Only {item.product.stock} available</p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          disabled={updating === item.productId}
                          className="px-2.5 py-1 text-gray-500 hover:bg-gray-50"
                        >
                          −
                        </button>
                        <span className="px-3 py-1 border-x text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          disabled={updating === item.productId}
                          className="px-2.5 py-1 text-gray-500 hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId)}
                        disabled={updating === item.productId}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      ${((item.product?.price || 0) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="w-full lg:w-80">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-32">
                <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal ({itemCount} items)</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Shipping</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold text-gray-900 text-base">
                    <span>Total</span>
                    <span className="text-orange-600">${total.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/checkout")}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg mt-6 transition-colors"
                >
                  Proceed to Checkout
                </button>
                <Link
                  to="/"
                  className="block text-center text-sm text-orange-500 hover:underline mt-3"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
            <p className="text-gray-500 mb-6">Start adding products to your cart</p>
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
