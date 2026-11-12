import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { privacyPolicy as policy } from "../mobile/content/privacy-policy.js";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../website/privacy-policy",
);
const sections = policy.sections
  .map(
    (section, index) =>
      `<section id="section-${index + 1}"><h2>${escape(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${escape(paragraph)}</p>`).join("\n")}</section>`,
  )
  .join("\n");
const contact = `<section id="contact" class="contact"><h2>Thông tin liên hệ</h2><p><strong>${escape(policy.company)}</strong></p><p>${escape(policy.address)}</p><p>Email: <a href="mailto:${escape(policy.email)}">${escape(policy.email)}</a><br>Điện thoại: <a href="tel:${policy.phoneNumber}">${escape(policy.phone)}</a><br>Website: <a href="${policy.website}">candientuquochung.com</a></p></section>`;
const contents = `${policy.sections.map((section, index) => `<a href="#section-${index + 1}">${escape(section.title)}</a>`).join("\n")}<a href="#contact">Thông tin liên hệ</a>`;
const article = `<article><h1>${escape(policy.title)}</h1><p class="updated">${policy.appName} · Cập nhật: ${policy.updatedOn}</p><p class="intro">${escape(policy.introduction)}</p><details class="mobile-contents"><summary>Mục lục chính sách</summary><nav aria-label="Mục lục trên điện thoại">${contents}</nav></details>${sections}${contact}</article>`;
const styles = fs.readFileSync(path.join(directory, "styles.css"), "utf8");
const navigationScript = `
const header = document.querySelector('.policy-header');
const updateHeaderOffset = () => document.documentElement.style.setProperty('--header-offset', (header.getBoundingClientRect().height + 16) + 'px');
updateHeaderOffset();
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateHeaderOffset).observe(header);
document.getElementById('policy-back').addEventListener('click', (event) => {
  if (window.history.length > 1) { event.preventDefault(); window.history.back(); }
});
document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
  const target = document.getElementById(link.getAttribute('href').slice(1));
  if (!target) return;
  event.preventDefault();
  link.closest('details')?.removeAttribute('open');
  target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}));
`;
const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${policy.title} — ${policy.appName} | Quốc Hưng</title><meta name="description" content="Chính sách quyền riêng tư của ứng dụng QHS Scales: thông tin được xử lý, phân quyền, lưu trữ và yêu cầu về dữ liệu."><meta name="color-scheme" content="light">
<style>
${styles}
</style></head><body><a class="skip" href="#policy">Đến nội dung chính sách</a><header class="policy-header"><div class="header-inner"><a id="policy-back" class="back" href="${policy.website}" aria-label="Quay lại trang trước"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14"/></svg><span>Quay lại</span></a><div class="header-brand"><a href="${policy.website}">CÂN ĐIỆN TỬ QUỐC HƯNG</a><p>QHS Scales · Quyền riêng tư</p></div></div></header><main class="layout" id="policy"><nav class="desktop-contents" aria-label="Nội dung chính sách"><strong>NỘI DUNG</strong>${contents}</nav>${article}</main><footer>© Quốc Hưng · ${policy.appName}</footer><script>${navigationScript}</script></body></html>`;
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, "index.html"), html, "utf8");
fs.writeFileSync(
  path.join(directory, "wordpress-content.html"),
  article,
  "utf8",
);
console.log(
  "Exported website/privacy-policy/index.html and wordpress-content.html",
);
