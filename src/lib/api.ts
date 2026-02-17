import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Types ───────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  phone?: string | null;
  avatar?: string | null;
  bio?: string | null;
  company?: string | null;
  createdAt?: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  parentId: string | null;
  children?: Category[];
  _count?: { products: number };
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAt?: number | null;
  images: string[];
  stock: number;
  minOrder: number;
  sku?: string | null;
  tags: string[];
  published: boolean;
  sellerId: string;
  categoryId: string;
  category?: Category;
  seller?: Pick<User, "id" | "name" | "company" | "avatar">;
  reviews?: Review[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: Pick<Product, "id" | "name" | "slug" | "images">;
}

export interface Order {
  id: string;
  buyerId: string;
  items: OrderItem[];
  total: number;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  shippingAddress?: unknown;
  paymentIntentId?: string | null;
  createdAt: string;
}

export interface CartItemResponse {
  id: string;
  productId: string;
  quantity: number;
  product: Pick<Product, "id" | "name" | "slug" | "price" | "images" | "stock"> | null;
}

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user?: Pick<User, "id" | "name" | "avatar">;
}

interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
  products?: T[];
  orders?: T[];
}

// ─── API Methods ─────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>("/auth-login", { email, password }),
  register: (data: { email: string; password: string; name: string; role: string; phone?: string; company?: string }) =>
    api.post<{ token: string; user: User }>("/auth-register", data),
};

export const productsApi = {
  getAll: (params?: { search?: string; category?: string; categoryId?: string; sellerId?: string; minPrice?: number; maxPrice?: number; sort?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Product> & { products: Product[] }>("/products", { params }),
  getById: (id: string) =>
    api.get<Product>(`/products?id=${id}`),
  getBySlug: (slug: string) =>
    api.get<Product>(`/products?slug=${slug}`),
  create: (data: Partial<Product>) =>
    api.post<Product>("/products", data),
  update: (id: string, data: Partial<Product>) =>
    api.put<Product>(`/products?id=${id}`, data),
  delete: (id: string) =>
    api.delete(`/products?id=${id}`),
};

export const categoriesApi = {
  getAll: (params?: { topLevel?: boolean }) =>
    api.get<Category[]>("/categories", { params: { topLevel: params?.topLevel ? "true" : undefined } }),
  getById: (id: string) =>
    api.get<Category>(`/categories?id=${id}`),
  getBySlug: (slug: string) =>
    api.get<Category>(`/categories?slug=${slug}`),
  create: (data: { name: string; parentId?: string; image?: string }) =>
    api.post<Category>("/categories", data),
  update: (id: string, data: Partial<Category>) =>
    api.put<Category>(`/categories?id=${id}`, data),
  delete: (id: string) =>
    api.delete(`/categories?id=${id}`),
};

export const cartApi = {
  get: () =>
    api.get<{ id: string; items: CartItemResponse[] }>("/cart"),
  addItem: (productId: string, quantity?: number) =>
    api.post("/cart", { productId, quantity }),
  updateItem: (productId: string, quantity: number) =>
    api.put("/cart", { productId, quantity }),
  removeItem: (productId: string) =>
    api.delete(`/cart?productId=${productId}`),
  clear: () =>
    api.delete("/cart"),
};

export const ordersApi = {
  getAll: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Order> & { orders: Order[] }>("/orders", { params }),
  getById: (id: string) =>
    api.get<Order>(`/orders?id=${id}`),
  create: (data: { items: { productId: string; quantity: number }[]; shippingAddress?: unknown }) =>
    api.post<Order>("/orders", data),
  updateStatus: (id: string, status: string) =>
    api.put<Order>(`/orders?id=${id}`, { status }),
};

export interface WishlistItemResponse {
  id: string;
  productId: string;
  createdAt: string;
  product: Pick<Product, "id" | "name" | "slug" | "price" | "images" | "stock"> | null;
}

export const wishlistApi = {
  get: () =>
    api.get<{ id: string; items: WishlistItemResponse[] }>("/wishlist"),
  addItem: (productId: string) =>
    api.post("/wishlist", { productId }),
  removeItem: (productId: string) =>
    api.delete(`/wishlist?productId=${productId}`),
};

export const usersApi = {
  getProfile: () =>
    api.get<User & { addresses?: Address[]; _count?: { products: number; reviews: number } }>("/users"),
  getPublicProfile: (id: string) =>
    api.get<User & { _count?: { products: number; reviews: number } }>(`/users?id=${id}`),
  updateProfile: (data: Partial<User> & { currentPassword?: string; newPassword?: string }) =>
    api.put<User>("/users", data),
  addAddress: (data: Omit<Address, "id" | "userId">) =>
    api.post("/users", { action: "add-address", ...data }),
  deleteAddress: (addressId: string) =>
    api.post("/users", { action: "delete-address", addressId }),
};
