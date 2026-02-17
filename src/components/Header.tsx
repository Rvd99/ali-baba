import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../lib/i18n";

export default function Header() {
  const { user, isAuthenticated, isSeller, logout } = useAuth();
  const { locale, setLocale } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="bg-[#1a1a2e] text-white sticky top-0 z-50 shadow-lg">
      {/* Top Bar */}
      <div className="bg-[#16162a] text-xs py-1.5">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <span className="text-gray-400">
            Welcome to AlibabaClone — Your Global Trade Marketplace
          </span>
          <div className="flex gap-4 text-gray-400 items-center">
            <button
              onClick={() => setLocale(locale === "en" ? "zh" : "en")}
              className="hover:text-white transition-colors text-xs border border-gray-600 px-2 py-0.5 rounded"
            >
              {locale === "en" ? "中文" : "EN"}
            </button>
            <span>|</span>
            <Link to="/help" className="hover:text-white transition-colors">Help</Link>
            <span>|</span>
            {isAuthenticated ? (
              <>
                <span className="text-orange-400">Hi, {user?.name}</span>
                <button onClick={logout} className="hover:text-white transition-colors">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
                <Link to="/register" className="hover:text-white transition-colors">Join Free</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <h1 className="text-2xl font-bold">
              <span className="text-orange-500">Alibaba</span>
              <span className="text-white">Clone</span>
            </h1>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
            <div className="flex">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, categories, suppliers..."
                className="w-full px-4 py-2.5 rounded-l-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 px-6 py-2.5 rounded-r-md font-medium text-sm transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Nav Links */}
          <nav className="flex items-center gap-4 text-sm">
            {isSeller && (
              <Link
                to="/seller/dashboard"
                className="hover:text-orange-400 transition-colors flex items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Sell
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to="/wishlist"
                className="hover:text-orange-400 transition-colors flex items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Wishlist
              </Link>
            )}
            <Link
              to="/cart"
              className="hover:text-orange-400 transition-colors flex items-center gap-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              Cart
            </Link>
            {isAuthenticated && (
              <Link
                to="/orders"
                className="hover:text-orange-400 transition-colors flex items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Orders
              </Link>
            )}
          </nav>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="bg-[#16162a] border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-2 flex gap-6 text-sm text-gray-300 overflow-x-auto">
          {["Electronics", "Clothing", "Home & Garden", "Sports", "Toys", "Auto Parts", "Health & Beauty", "Industrial"].map(
            (cat) => (
              <Link
                key={cat}
                to={`/?category=${encodeURIComponent(cat)}`}
                className="hover:text-orange-400 whitespace-nowrap transition-colors"
              >
                {cat}
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
