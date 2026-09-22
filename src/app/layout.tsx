import { AppHeader } from "@/components/navigation/app-header";
import { PRODUCT } from "@/config/product";
import type { Metadata } from "next";
import Providers from "./providers";
import { Box, Flex } from "@chakra-ui/react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCT.canonicalOrigin),
  title: {
    default: PRODUCT.title,
    template: `%s | ${PRODUCT.name}`,
  },
  description: PRODUCT.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Flex maxHeight="100vh" gap={4}>
            <AppHeader />

            <Box overflowY={"scroll"} flex={1} pr={6}>
              {children}
            </Box>
          </Flex>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
