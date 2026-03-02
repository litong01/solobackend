"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center text-gray-500">
      Loading Swagger UI…
    </div>
  ),
});

export function SwaggerUIWrapper() {
  return (
    <div className="swagger-ui-wrapper">
      <SwaggerUI url="/api/openapi" />
    </div>
  );
}
