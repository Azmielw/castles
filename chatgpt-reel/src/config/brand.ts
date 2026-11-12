// 🟢 الشعار
// لاستخدام شعار ChatGPT الرسمي: نزّل ملف الشعار من صفحة الهوية الرسمية لـ OpenAI،
// واحفظه باسم public/brand/chatgpt-logo.svg (أو png)، وغيّر OFFICIAL_LOGO لاسم الملف.
// طول ما القيمة null، الفيديو بيعرض شارة نصية محايدة بدل الشعار (من غير تقليد أو رسم للشعار).
export const BRAND = {
  OFFICIAL_LOGO: null as null | string, // مثال: "brand/chatgpt-logo.svg"
  /** لون الشعار الرسمي لو ملف أسود/أبيض: "white" | "black" | "original" */
  LOGO_TINT: "white" as "white" | "black" | "original",
  NAME: "ChatGPT",
  /** سطر صغير في الخاتمة. اتركه "" لإخفائه. */
  DISCLAIMER: "فيديو تعليمي غير رسمي • المميزات بتختلف حسب الخطة والجهاز",
};
