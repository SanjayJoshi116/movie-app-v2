// Layout.js
import React from "react";
import Header from "./Header";

const Layout = ({ children, onSearch, onGenreChange }) => {
  return (
    <div>
      <Header onSearch={onSearch} onGenreChange={onGenreChange} />
      <main>{children}</main>
    </div>
  );
};

export default Layout;
