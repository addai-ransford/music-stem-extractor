import React from "react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        marginTop: "auto",
        padding: "16px",
        textAlign: "center",
        color: "#f0f0f0",
        fontSize: "0.9rem",
      }}
    >
      <h4>
        © {currentYear} • Built by{" "}
        <a
          href="https://github.com/addai-ransford"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#fff", textDecoration: "underline" }}
        >
          Nojar IT Services
        </a>
      </h4>
    </footer>
  );
}