import { App } from "antd";

export function useNotification() {
  const { message } = App.useApp();
  return {
    success: (msg: string) => message.success(msg),
    error: (msg: string) => message.error(msg),
    warning: (msg: string) => message.warning(msg),
    info: (msg: string) => message.info(msg),
  };
}
