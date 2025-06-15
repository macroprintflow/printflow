// lib/gemini/geminiClient.ts
import { GoogleAuth } from "google-auth-library";

const credentials = {
  type: "service_account",
  project_id: "printflow-x947t",
  private_key_id: "76d7b9079601b30a09a00d3df82aeb42c903a1c5",
  private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDBFGwyYlHBAmIW\nQ9wDijxyi9JF/Bs3l7uIJqWQMMhaUIBJ6NcyNCrLz866JtA139/2o9BNDV9Jeigl\nEEkbUT5l00Ssl9Zu007bay5uK7jjNcyxfEEOtfGAYvJuhJTP+d9LRBMpe0sKwb4G\nmKpD2aEBmS+xlPpKFP1Kpacbg1M2AXkOmMwvr7L57qEF26jreYKAlvZDfH3oDFH7\nlXTw8Mpej1UBOdEPwErFoloQWagm1rFRgSXyoheZ6Pgp13l4WRS4SJcMFl/KLXj+\nv3+0s+sM+nOMInr4PJ9cJicHKO5+334CZWJ2mzPHYknfo5550Yxeh+SXp0jiTlbD\nL6HNPDzzAgMBAAECggEAR/+sGxuzvcP8PK5AYGePg+1k02kf4xqnOS2kJoEybQ9A\nz47OlG+El+zde2gW00gw9YF/nwQCCN3PE4cfo9qnaIQgQzX5pekRKlws+7M9Jij9\nNCAQCILLVCNRoOm6rlVQsXnopVrPEGtPx5jtQRDp67UqZk+WB8MM8uWTy3wsruG2\n5H84sQHiPggepe3dqK78nQ4IP0rsr9DIs9MvUudchPYd4UjThbkSKSBxtbRCsAbc\nqIwrg2ak2zVF/gvH29HgGubKHDGq2svdaAupUy2K1pHKGRHEPyQjQluckbbBXDIl\nQO1sRZw7KylqX3rZECPF6zwp7iD5zL1j3YVkVpjIiQKBgQDh0ZjroaQOrKphJw85\niJCeqZJBWZ2aoR1Ff/47PcVMJtKwHzHsm/i1WzxpSMTdhkp0Gako0/Wi1YA36tGY\na1IA4EwE9/rOIyFIlwgk0hGmbRNMBu5h6a/bRC1+BUUMuwwlRpFTj/OZrT11VuTU\nDKgGaHj3VEF3tZrh9hEK89ggWwKBgQDa4qjYu5CjdZ5p3XvZD3enhzClteVR4LS0\n3yYfTnbCOZ2jkGfDnfO899rvc/PBmYS0mb3/u49pJX4fqCkSYL5b48W7gNEzAOmm\nZPM2S/2F89cJUlOWpq75Wu+ViSIOnt5mCANfeKICruL7dhzZB3GaYJyn0dIPEMWd\nMeDi2PB5SQKBgQCe2GUNOwLAH80p0ePvwJSaRwXOWk92ueZxQPuAiI8EZjrGEOt5\nWK22RJtWJA33FcPBr1tCkPa0uCIdM1yELtncK+rNg/I0lpmPCk58OBiaTRfJ3wZI\nca12O5sUjnhn4BtHDUCk2xmr/CTDKYCFePGosEyHDgmPP3vXftO2NJjPCQKBgAel\nHQKc4ntjE0pdSwMU0DgQt7lB9iV69LTQinNTeUBlZMUeuRETBj1WZtYwNZZQd1sb\nd5BkC6k/fv06EV0r9dodxX08DZJ7eK2wHvKJiuxPzPXtYzAC2F+rNm0Boifikp/7\nrap6+yWe2ByyTmWiJeyfbTlLUcvm6RAJevJRY2zJAoGBAMw7DzggRJylXiCJoYh5\nXJPr76iojA3WWYBEVX4LujkVLGN6c1uagZmgu6rkyi2WvaZHT0fw/qzCaGJduqhb\nGzxadDu03qJILBeYsnnKR4dAVYDlk4YxLL1bdaqYius03MuXTzOFtrhNzPqR4Rxg\ngezU2ZMZNUVUWutvNLQq5v5H\n-----END PRIVATE KEY-----\n`,
  client_email: "gemini-server-access@printflow-x947t.iam.gserviceaccount.com",
  client_id: "107387890049987556947",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/gemini-server-access%40printflow-x947t.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

export async function callGemini(prompt: string): Promise<string> {
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const res = await fetch(
    `https://us-central1-aiplatform.googleapis.com/v1/projects/printflow-x947t/locations/us-central1/publishers/google/models/gemini-1.5-pro:generateContent`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const json = await res.json();

  if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
    return json.candidates[0].content.parts[0].text;
  } else {
    console.error("[Gemini] Error response:", json);
    return "❌ Gemini failed. See logs.";
  }
}
