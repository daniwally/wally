"use client";

import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import {
  addCustomMerchantType,
  deleteCustomMerchantType,
  suggestIconForLabel,
} from "@/app/actions";

type CustomType = {
  slug: string;
  label: string;
  icon: string | null;
  description: string | null;
  is_essential: boolean | null;
};

export function CustomTypesManager({ customTypes }: { customTypes: CustomType[] }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("");
  const [isSuggesting, startSuggest] = useTransition();

  const suggest = () => {
    if (!label.trim()) return;
    startSuggest(async () => {
      const emoji = await suggestIconForLabel(label);
      setIcon(emoji);
    });
  };

  return (
    <div className="v2-card" style={{ marginTop: 16, padding: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "16px 20px",
          background: "transparent",
          border: "none",
          borderBottom: open ? "1px solid var(--border)" : "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--sans)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div className="v2-card-title">➕ Categorías personalizadas</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
            {customTypes.length} custom · agregá tipos de gasto propios (ej &ldquo;libros&rdquo;,
            &ldquo;juguetes&rdquo;). El extractor las toma en cuenta en cada scan.
          </div>
        </div>
        <span
          style={{
            fontSize: 14,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
            color: "var(--text-3)",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <>
          {/* Form nuevo */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            <form
              action={async (fd) => {
                await addCustomMerchantType(fd);
                setLabel("");
                setIcon("");
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "auto auto 1fr 1.6fr auto auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                name="icon"
                placeholder="·"
                maxLength={4}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="v2-input"
                style={{
                  width: 50,
                  textAlign: "center",
                  fontSize: 16,
                  padding: "5px 8px",
                }}
              />
              <button
                type="button"
                onClick={suggest}
                disabled={!label.trim() || isSuggesting}
                className="v2-btn sm"
                style={{
                  padding: "5px 8px",
                  opacity: !label.trim() || isSuggesting ? 0.5 : 1,
                }}
                title="Sugerir ícono con IA según el label"
              >
                {isSuggesting ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      border: "2px solid currentColor",
                      borderTopColor: "transparent",
                      animation: "v2-spin 0.7s linear infinite",
                    }}
                  />
                ) : (
                  "✨"
                )}
              </button>
              <input
                name="label"
                placeholder="Libros"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                className="v2-input"
                style={{ fontSize: 13, padding: "7px 10px" }}
              />
              <input
                name="description"
                placeholder="libros, revistas, e-books (opcional)"
                className="v2-input"
                style={{ fontSize: 12, padding: "7px 10px" }}
              />
              <select
                name="is_essential"
                defaultValue=""
                className="v2-select"
                style={{ fontSize: 12, padding: "7px 8px", width: "auto" }}
              >
                <option value="">— indef —</option>
                <option value="true">Esencial</option>
                <option value="false">Discrec.</option>
              </select>
              <button type="submit" className="v2-btn sm primary">
                <Icon.plus /> Agregar
              </button>
            </form>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
              💡 El <strong>slug</strong> se genera solo desde el label (&ldquo;Mantenimiento
              Auto&rdquo; → <code>mantenimiento_auto</code>). Click en <strong>✨</strong> para
              que Claude elija un emoji según el label.
            </div>
          </div>

          {/* Lista (ordenada alfabéticamente) */}
          {customTypes.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 13,
              }}
            >
              No hay categorías custom todavía. Agregá la primera arriba ↑
            </div>
          ) : (
            <table className="v2-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Label</th>
                  <th>Slug</th>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...customTypes]
                  .sort((a, b) => a.label.localeCompare(b.label, "es"))
                  .map((t) => (
                  <tr key={t.slug}>
                    <td style={{ fontSize: 18, textAlign: "center" }}>{t.icon ?? "·"}</td>
                    <td style={{ fontWeight: 500 }}>{t.label}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-3)" }}>
                      {t.slug}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {t.description ?? "—"}
                    </td>
                    <td>
                      {t.is_essential === true && (
                        <span className="v2-badge green">esencial</span>
                      )}
                      {t.is_essential === false && (
                        <span className="v2-badge amber">discrecional</span>
                      )}
                      {t.is_essential == null && (
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <form action={deleteCustomMerchantType}>
                        <input type="hidden" name="slug" value={t.slug} />
                        <button
                          type="submit"
                          className="v2-btn sm ghost"
                          style={{ color: "var(--red)" }}
                        >
                          <Icon.trash />
                        </button>
                      </form>
                    </td>
                  </tr>
                  ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
