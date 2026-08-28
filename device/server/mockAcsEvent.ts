import type { AcsEventResponse } from "../src/types/acsEvent";

/** Kamera ulanmaganda UI ni sinash uchun demo javob. */
export function buildMockAcsEventResponse(): AcsEventResponse {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  return {
    AcsEvent: {
      searchID: "1",
      totalMatches: 2,
      responseStatusStrg: "OK",
      numOfMatches: 2,
      InfoList: [
        {
          major: 5,
          minor: 75,
          time: `${date}T08:45:00+05:00`,
          cardType: 1,
          name: "Karimov Sardor",
          cardReaderNo: 1,
          doorNo: 1,
          employeeNoString: "1001",
          serialNo: 101,
          userType: "normal",
          currentVerifyMode: "face",
          mask: "no",
          pictureURL: "",
        },
        {
          major: 5,
          minor: 75,
          time: `${date}T09:25:00+05:00`,
          cardType: 1,
          name: "Aliyeva Nilufar",
          cardReaderNo: 1,
          doorNo: 1,
          employeeNoString: "1002",
          serialNo: 102,
          userType: "normal",
          currentVerifyMode: "face",
          mask: "no",
          pictureURL: "",
        },
      ],
    },
  };
}
