import React, { createContext, useState, useMemo, type ReactNode } from "react";
import toast, { Toaster } from "react-hot-toast";

export type ToastType = "success" | "error" | "loading";

export interface ToastOptions {
  duration?: number;
  position?:
    | "top-right"
    | "top-center"
    | "top-left"
    | "bottom-right"
    | "bottom-center"
    | "bottom-left";
}

const GlobalContext = createContext<{
  menuIsOpen: boolean;
  menuSectionExpanded: string | null;
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  setMenuSectionExpanded: (value: string | null) => void;
  setMenuIsOpen: (value: boolean) => void;
  showToast: (
    message: string,
    type?: ToastType,
    options?: ToastOptions
  ) => void;
} | null>(null);

export const GlobalContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [menuIsOpen, setMenuIsOpen] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [menuSectionExpanded, setMenuSectionExpanded] = useState<string | null>(
    null
  );

  const showToast = (
    message: string,
    type: ToastType = "success",
    options: ToastOptions = {}
  ) => {
    const defaultOptions: Required<
      Pick<ToastOptions, "duration" | "position">
    > = {
      duration: 4000,
      position: "top-right",
      ...options,
    };

    switch (type) {
      case "success":
        toast.success(message, defaultOptions);
        break;
      case "error":
        toast.error(message, defaultOptions);
        break;
      case "loading":
        toast.loading(message, defaultOptions);
        break;
      default:
        toast(message, defaultOptions);
    }
  };

  const value = useMemo(() => {
    return {
      menuIsOpen,
      menuSectionExpanded,
      setMenuIsOpen,
      setMenuSectionExpanded,
      isLoading,
      setIsLoading,
      showToast,
    };
  }, [menuIsOpen, menuSectionExpanded, isLoading, setIsLoading]);

  return (
    <GlobalContext.Provider value={value}>
      <Toaster
        position="top-right"
        containerStyle={{
          filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1))",
        }}
        toastOptions={{
          style: {
            fontFamily: "Helvetica, sans-serif",
            fontSize: "14px",
            fontWeight: 500,
          },
        }}
      />
      {children}
    </GlobalContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useGlobalContext = () => React.useContext(GlobalContext);
