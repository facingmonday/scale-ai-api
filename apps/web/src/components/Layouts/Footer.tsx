import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-brand-blue border-t border-ui-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          {/* LEFT — Copyright */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-white">
              © {new Date().getFullYear()} NWA Apps. All rights reserved.
            </span>
          </div>

          {/* RIGHT — Links */}
          <div className="flex items-center gap-4">
            <Link
              to="/profile"
              className="text-sm text-white hover:text-brand-teal transition-colors"
            >
              Profile
            </Link>
            <Link
              to="/settings"
              className="text-sm text-white hover:text-brand-teal transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
