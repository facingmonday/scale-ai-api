import { type ReactNode, useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import FloatingChat from "../AIComponents/FloatingChat";

interface Props {
  children?: ReactNode;
  loading?: boolean;
}

const BasicLayout: React.FC<Props> = ({ children }: Props) => {
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 640); // 640px is sm breakpoint in Tailwind
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  return (
    <>
      <Header />
      <div className="flex flex-row w-full min-h-screen bg-ui-bg sm:pt-16 pt-32 pb-12">
        <main
          className="flex-grow py-2 flex flex-col"
          style={{
            margin: isSmallScreen ? "0px 10px 20px 10px" : "0px 20px 20px 20px",
          }}
        >
          {children}
        </main>
      </div>
      <Footer />
      <FloatingChat />
    </>
  );
};

export default BasicLayout;
