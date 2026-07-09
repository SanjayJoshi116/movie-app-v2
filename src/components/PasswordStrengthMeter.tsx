import { Progress, theme, Typography } from "antd";
import { getPasswordStrength } from "../utils/passwordStrength";
import { FONT_SIZE } from "../constants/typography";

interface Props {
  password: string;
}

export default function PasswordStrengthMeter({ password }: Props) {
  const { token } = theme.useToken();

  if (!password) return null;

  const { score, label } = getPasswordStrength(password);
  const colors = [token.colorError, token.colorError, token.colorWarning, token.colorSuccess, token.colorSuccess];

  return (
    <div style={{ marginTop: -8, marginBottom: 12 }}>
      <Progress percent={(score + 1) * 20} showInfo={false} strokeColor={colors[score]} size="small" />
      <Typography.Text style={{ fontSize: FONT_SIZE.caption, color: colors[score] }}>{label}</Typography.Text>
    </div>
  );
}
