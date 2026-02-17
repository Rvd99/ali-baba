import { Link } from "react-router-dom";
import type { Product } from "../lib/api";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const placeholderImage =
    "https://placehold.co/400x400/f5f5f5/999?text=" + encodeURIComponent(product.name.slice(0, 12));

  return (
    <Link
      to={`/products/${product.id}`}
      className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className="aspect-square bg-gray-50 overflow-hidden">
        <img
          src={product.images?.[0] || placeholderImage}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2 group-hover:text-orange-600 transition-colors">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-orange-600">
            ${product.price.toFixed(2)}
          </span>
          <span className="text-xs text-gray-400">/piece</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Min. order: 1 piece
          </span>
          {product.stock > 0 ? (
            <span className="text-xs text-green-600 font-medium">In Stock</span>
          ) : (
            <span className="text-xs text-red-500 font-medium">Out of Stock</span>
          )}
        </div>
        {product.category && (
          <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {product.category.name}
          </span>
        )}
      </div>
    </Link>
  );
}
