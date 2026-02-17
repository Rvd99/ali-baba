import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Locale = "en" | "zh";

const translations: Record<Locale, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.cart": "Cart",
    "nav.orders": "My Orders",
    "nav.login": "Login",
    "nav.register": "Register",
    "nav.logout": "Logout",
    "nav.seller_dashboard": "Seller Dashboard",
    "nav.search_placeholder": "Search products...",
    "home.hero_title": "Source from Global Suppliers",
    "home.hero_subtitle": "Discover millions of products at wholesale prices. Connect directly with verified manufacturers.",
    "home.start_sourcing": "Start Sourcing",
    "home.become_seller": "Become a Seller",
    "home.filters": "Filters",
    "home.categories": "Categories",
    "home.price_range": "Price Range",
    "home.products_found": "products found",
    "home.sort_best": "Sort by: Best Match",
    "home.sort_price_asc": "Price: Low to High",
    "home.sort_price_desc": "Price: High to Low",
    "home.sort_newest": "Newest First",
    "home.no_products": "No products found",
    "home.adjust_search": "Try adjusting your search or filters",
    "product.add_to_cart": "Add to Cart",
    "product.buy_now": "Buy Now",
    "product.in_stock": "in stock",
    "product.out_of_stock": "Out of stock",
    "product.min_order": "Min. order",
    "product.reviews": "Customer Reviews",
    "product.write_review": "Write a Review",
    "product.submit_review": "Submit Review",
    "product.no_reviews": "No reviews yet. Be the first to review this product!",
    "cart.title": "Shopping Cart",
    "cart.empty": "Your cart is empty",
    "cart.start_adding": "Start adding products to your cart",
    "cart.browse": "Browse Products",
    "cart.continue": "Continue Shopping",
    "cart.subtotal": "Subtotal",
    "cart.shipping": "Shipping",
    "cart.free": "Free",
    "cart.total": "Total",
    "cart.checkout": "Proceed to Checkout",
    "cart.remove": "Remove",
    "orders.title": "My Orders",
    "orders.empty": "No orders yet",
    "orders.start_shopping": "Start shopping to see your orders here",
    "orders.cancel": "Cancel Order",
    "checkout.title": "Checkout",
    "checkout.shipping": "Shipping Address",
    "checkout.payment": "Payment Method",
    "checkout.pay_card": "Pay with Card (Stripe)",
    "checkout.pay_later": "Place Order (Pay Later)",
    "checkout.place_order": "Place Order",
    "checkout.back_to_cart": "Back to Cart",
    "seller.dashboard": "Seller Dashboard",
    "seller.welcome": "Welcome back",
    "seller.total_products": "Total Products",
    "seller.revenue": "Total Revenue",
    "seller.pending_orders": "Pending Orders",
    "seller.add_product": "Add Product",
    "seller.your_products": "Your Products",
    "footer.about": "About Us",
    "footer.contact": "Contact",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Terms of Service",
  },
  zh: {
    "nav.home": "首页",
    "nav.cart": "购物车",
    "nav.orders": "我的订单",
    "nav.login": "登录",
    "nav.register": "注册",
    "nav.logout": "退出",
    "nav.seller_dashboard": "卖家中心",
    "nav.search_placeholder": "搜索商品...",
    "home.hero_title": "全球供应商采购",
    "home.hero_subtitle": "以批发价发现数百万种产品。直接与认证制造商联系。",
    "home.start_sourcing": "开始采购",
    "home.become_seller": "成为卖家",
    "home.filters": "筛选",
    "home.categories": "分类",
    "home.price_range": "价格范围",
    "home.products_found": "件商品",
    "home.sort_best": "排序：最佳匹配",
    "home.sort_price_asc": "价格：从低到高",
    "home.sort_price_desc": "价格：从高到低",
    "home.sort_newest": "最新上架",
    "home.no_products": "未找到商品",
    "home.adjust_search": "尝试调整搜索条件或筛选项",
    "product.add_to_cart": "加入购物车",
    "product.buy_now": "立即购买",
    "product.in_stock": "有货",
    "product.out_of_stock": "缺货",
    "product.min_order": "最小起订量",
    "product.reviews": "用户评价",
    "product.write_review": "撰写评价",
    "product.submit_review": "提交评价",
    "product.no_reviews": "暂无评价。成为第一个评价此商品的人！",
    "cart.title": "购物车",
    "cart.empty": "购物车为空",
    "cart.start_adding": "开始添加商品到购物车",
    "cart.browse": "浏览商品",
    "cart.continue": "继续购物",
    "cart.subtotal": "小计",
    "cart.shipping": "运费",
    "cart.free": "免费",
    "cart.total": "合计",
    "cart.checkout": "去结算",
    "cart.remove": "删除",
    "orders.title": "我的订单",
    "orders.empty": "暂无订单",
    "orders.start_shopping": "开始购物来查看您的订单",
    "orders.cancel": "取消订单",
    "checkout.title": "结算",
    "checkout.shipping": "收货地址",
    "checkout.payment": "支付方式",
    "checkout.pay_card": "银行卡支付 (Stripe)",
    "checkout.pay_later": "货到付款",
    "checkout.place_order": "提交订单",
    "checkout.back_to_cart": "返回购物车",
    "seller.dashboard": "卖家中心",
    "seller.welcome": "欢迎回来",
    "seller.total_products": "商品总数",
    "seller.revenue": "总收入",
    "seller.pending_orders": "待处理订单",
    "seller.add_product": "添加商品",
    "seller.your_products": "您的商品",
    "footer.about": "关于我们",
    "footer.contact": "联系方式",
    "footer.privacy": "隐私政策",
    "footer.terms": "服务条款",
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    () => (localStorage.getItem("locale") as Locale) || "en"
  );

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[locale]?.[key] || translations.en[key] || key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
