import React from "react";
import { Pagination as AntPagination } from "antd";

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: Props) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
      <AntPagination
        current={currentPage}
        total={totalPages * 20}
        pageSize={20}
        onChange={onPageChange}
        showSizeChanger={false}
        showQuickJumper={totalPages > 10}
      />
    </div>
  );
}

export default Pagination;
