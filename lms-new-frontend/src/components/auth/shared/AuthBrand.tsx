interface AuthBrandProps {
  className?: string;
}

const AuthBrand = ({ className = "mb-4" }: AuthBrandProps) => {
  return (
    <div className={`auth-brand text-center mx-auto ${className}`}>
      <span className="auth-brand-mark">QA</span>
      <span className="auth-brand-name">LMS</span>
    </div>
  );
};

export default AuthBrand;
