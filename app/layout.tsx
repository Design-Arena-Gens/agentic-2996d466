export const metadata = {
  title: "Modern Fa?ade Renderer | 8K Export",
  description: "Procedural concrete + glass + wood fa?ade with daylight and 8K export",
  icons: [{ rel: "icon", url: "/favicon.ico" }]
};

import "../styles/globals.css";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
