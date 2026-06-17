export interface MarketProfile {
  country: string;
  currency: string;
  currencySymbol: string;
  avgIncome: { low: string; middle: string; high: string };
  economicContext: string;
  culturalContext: string;
  digitalBehavior: string;
  paymentBehavior: string;
  isGlobal?: boolean;
}

export const MARKET_PROFILES: Record<string, MarketProfile> = {
  "Egypt": {
    country: "Egypt",
    currency: "EGP",
    currencySymbol: "ج.م",
    avgIncome: { low: "2,000-4,000 EGP/month", middle: "5,000-15,000 EGP/month", high: "20,000+ EGP/month" },
    economicContext: "High inflation (30%+), dollar-sensitive, installment culture (تقسيط) is standard",
    culturalContext: "Family decisions, peer social proof critical, Cairo/Alex vs other cities differ significantly",
    digitalBehavior: "Facebook dominates, WhatsApp for peer decisions, YouTube for research, TikTok growing",
    paymentBehavior: "Cash preference, installments expected for high-ticket, low credit card penetration",
  },
  "UAE": {
    country: "UAE",
    currency: "AED",
    currencySymbol: "د.إ",
    avgIncome: { low: "2,000-5,000 AED/month", middle: "8,000-20,000 AED/month", high: "25,000+ AED/month" },
    economicContext: "90% expat population, premium brand market, strong USD peg, status-driven spending",
    culturalContext: "Two segments: Emirati (Arabic, tradition-aware) and expat (English, global expectations)",
    digitalBehavior: "Instagram and LinkedIn dominant, English and Arabic content, high smartphone penetration",
    paymentBehavior: "Strong credit card culture, subscription model familiar, premium price tolerance high",
  },
  "Saudi Arabia": {
    country: "Saudi Arabia",
    currency: "SAR",
    currencySymbol: "ر.س",
    avgIncome: { low: "3,000-6,000 SAR/month", middle: "10,000-25,000 SAR/month", high: "35,000+ SAR/month" },
    economicContext: "Vision 2030, high spending power, transition to digital economy, youth-dominated market",
    culturalContext: "Strong Islamic values, family-centric, high social media engagement (Snapchat/Twitter)",
    digitalBehavior: "Snapchat is king, Twitter (X) for news, YouTube for lifestyle, high gaming penetration",
    paymentBehavior: "Mada (local debit) is universal, STC Pay, growing credit culture, high COD preference still",
  },
  "Jordan": {
    country: "Jordan",
    currency: "JOD",
    currencySymbol: "د.أ",
    avgIncome: { low: "300-500 JOD/month", middle: "700-1,500 JOD/month", high: "2,500+ JOD/month" },
    economicContext: "Resource-limited, high cost of living, young and educated workforce, heavily reliant on remittances",
    culturalContext: "Hospitality, social reputation, close family ties, Amman vs governorates gap",
    digitalBehavior: "Facebook, Instagram, WhatsApp groups, price-checking is constant",
    paymentBehavior: "Cash is dominant, e-wallets (ZainCash) growing, installments via banks",
  },
  "Global": {
    country: "Global",
    currency: "USD",
    currencySymbol: "$",
    avgIncome: { low: "$30,000/yr", middle: "$60,000-$100,000/yr", high: "$150,000+/yr" },
    economicContext: "⚠️ US market benchmark. Adjust for your actual market.",
    culturalContext: "⚠️ US cultural norms. May not reflect your audience.",
    digitalBehavior: "Google, Instagram, YouTube, TikTok",
    paymentBehavior: "Credit card standard, subscription-friendly",
    isGlobal: true,
  }
};

export const buildMarketContext = (country: string): string => {
  const profile = MARKET_PROFILES[country] || MARKET_PROFILES["Global"];
  
  const warning = profile.isGlobal 
    ? "⚠️ GLOBAL MODE: Using US market benchmarks. Income and pricing data reflects US consumers.\n\n"
    : "";
  
  return `${warning}MARKET CONTEXT:
Country: ${profile.country}
Currency: ${profile.currency} (${profile.currencySymbol})
Income ranges: Low: ${profile.avgIncome.low} | Middle: ${profile.avgIncome.middle} | High: ${profile.avgIncome.high}
Economic: ${profile.economicContext}
Cultural: ${profile.culturalContext}
Digital behavior: ${profile.digitalBehavior}
Payment behavior: ${profile.paymentBehavior}`;
};
