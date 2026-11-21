"use client";

type Props = {
  label?: string;
};

const FullScreenLoader = ({ label = "Loading dashboard..." }: Props) => {
  return (
    <div className="vh-100 vw-100 d-flex align-items-center justify-content-center bg-body">
      <div className="text-center">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="text-muted mb-0">{label}</p>
      </div>
    </div>
  );
};

export default FullScreenLoader;

