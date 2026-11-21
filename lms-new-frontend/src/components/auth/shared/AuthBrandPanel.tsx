import { ReactNode } from "react";
import ImageWithBasePath from "@/core/imageWithBasePath";

interface AuthBrandPanelProps {
  heading: ReactNode;
  description: string;
  image?: string;
}

const AuthBrandPanel = ({ heading, description, image }: AuthBrandPanelProps) => {
  return (
    <div className="text-center text-white mx-auto" style={{ maxWidth: 440 }}>
      <h1 className="fs-32 fw-bold mb-3">{heading}</h1>
      <p className="fs-16 mb-0 auth-side-panel-copy">{description}</p>
      {image && (
        <div className="mt-5 mx-auto">
          <ImageWithBasePath src={image} alt="" className="img-fluid" />
        </div>
      )}
    </div>
  );
};

export default AuthBrandPanel;
