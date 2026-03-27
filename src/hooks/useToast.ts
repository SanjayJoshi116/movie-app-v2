import { App } from "antd";

export function useToast() {
  const { message } = App.useApp();

  return {
    showSuccess: (msg: string) => message.success(msg, 2),
    showError: (msg: string) => message.error(msg, 3),
    showInfo: (msg: string) => message.info(msg, 2),
  };
}
