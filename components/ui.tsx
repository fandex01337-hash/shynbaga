import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 border-t-4 border-t-[#c9962b] bg-white/95 p-4 shadow-[0_8px_30px_-12px_rgba(85,72,54,0.35)] sm:p-6 ${className}`}>{children}</section>;
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-md hover:from-blue-700 hover:to-blue-900 disabled:from-slate-400 disabled:to-slate-400",
  secondary: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "text-blue-800 hover:bg-blue-50 disabled:text-slate-400",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-3 text-xl font-bold text-slate-900">
      {children}
    </h2>
  );
}
