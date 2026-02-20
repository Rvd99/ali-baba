import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import PrivateRoute from "./components/PrivateRoute";
import HomePage from "./pages/HomePage";
import ProductPage from "./pages/ProductPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SignUp from "./pages/SignUp";
import CartPage from "./pages/CartPage";
import OrdersPage from "./pages/OrdersPage";
import SellerDashboard from "./pages/SellerDashboard";
import CheckoutPage from "./pages/CheckoutPage";
import WishlistPage from "./pages/WishlistPage";

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/cart" element={<CartPage />} />

          {/* Protected Routes */}
          <Route element={<PrivateRoute />}>
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
          </Route>

          {/* Seller Routes */}
          <Route element={<PrivateRoute requiredRole="SELLER" />}>
            <Route path="/seller/dashboard" element={<SellerDashboard />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
