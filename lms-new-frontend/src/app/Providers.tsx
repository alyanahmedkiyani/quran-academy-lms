"use client";

import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { App, ConfigProvider } from "antd";
import store from "@/core/redux/store";
import { useAppDispatch } from "@/core/redux/hooks";
import { getStoredAuth } from "@/lib/auth-storage";
import { setCredentials, clearAuth } from "@/core/redux/authSlice";

type Props = {
  children: React.ReactNode;
};

const antdTheme = {
  token: {
    colorPrimary: "#2E37A4",
    colorSuccess: "#27AE60",
    colorWarning: "#E2B93B",
    colorError: "#EF1E1E",
    colorInfo: "#2F80ED",
    borderRadius: 6,
    fontFamily: "Poppins, sans-serif",
  },
  components: {
    DatePicker: {
      cellHoverBg: "#ECEDF7",
      cellActiveWithRangeBg: "#ECEDF7",
      activeBorderColor: "#2E37A4",
      hoverBorderColor: "#3C449C",
    },
  },
};

const AuthHydrator = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const payload = getStoredAuth();
    if (payload) {
      dispatch(setCredentials(payload));
    } else {
      dispatch(clearAuth());
    }
  }, [dispatch]);

  return <>{children}</>;
};

export default function Providers({ children }: Props) {
  return (
    <Provider store={store}>
      <ConfigProvider theme={antdTheme}>
        <App>
          <AuthHydrator>{children}</AuthHydrator>
        </App>
      </ConfigProvider>
    </Provider>
  );
}
