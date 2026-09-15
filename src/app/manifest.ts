import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "공시한눈",
    short_name: "공시한눈",
    description: "관심기업의 중요한 공시를 쉽고 빠르게 확인합니다.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#1769e0",
    icons: [
      {
        src: "/gongsi-hannun-app-icon.png",
        sizes: "128x128",
        type: "image/png",
      },
    ],
  };
}
