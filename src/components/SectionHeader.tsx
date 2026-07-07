import { Divider, Typography } from "antd";

interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <Divider orientation="left">
      <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
    </Divider>
  );
}
