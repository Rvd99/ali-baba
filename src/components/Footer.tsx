import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-[#1a1a2e] text-gray-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">
              <span className="text-orange-500">Alibaba</span>Clone
            </h3>
            <p className="text-sm leading-relaxed">
              Your trusted global trade marketplace. Connect with suppliers and buyers worldwide.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-medium mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-orange-400 transition-colors">Home</Link></li>
              <li><Link to="/products" className="hover:text-orange-400 transition-colors">Products</Link></li>
              <li><Link to="/categories" className="hover:text-orange-400 transition-colors">Categories</Link></li>
              <li><Link to="/sellers" className="hover:text-orange-400 transition-colors">Sellers</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white font-medium mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/help" className="hover:text-orange-400 transition-colors">Help Center</Link></li>
              <li><Link to="/shipping" className="hover:text-orange-400 transition-colors">Shipping Info</Link></li>
              <li><Link to="/returns" className="hover:text-orange-400 transition-colors">Returns</Link></li>
              <li><Link to="/contact" className="hover:text-orange-400 transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-medium mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="hover:text-orange-400 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-orange-400 transition-colors">Terms of Service</Link></li>
              <li><Link to="/cookies" className="hover:text-orange-400 transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
          <p>&copy; {new Date().getFullYear()} AlibabaClone. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-orange-400 transition-colors">Facebook</a>
            <a href="#" className="hover:text-orange-400 transition-colors">Twitter</a>
            <a href="#" className="hover:text-orange-400 transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-orange-400 transition-colors">Instagram</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
