export type FaceRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type AcsEventInfo = {
  major: number;
  minor: number;
  time: string;
  cardType?: number;
  name?: string;
  cardReaderNo?: number;
  doorNo?: number;
  employeeNoString?: string;
  serialNo?: number;
  userType?: string;
  currentVerifyMode?: string;
  attendanceStatus?: string;
  label?: string;
  mask?: string;
  pictureURL?: string;
  FaceRect?: FaceRect;
};

export type AcsEventResponse = {
  AcsEvent?: {
    searchID?: string;
    totalMatches?: number;
    responseStatusStrg?: string;
    numOfMatches?: number;
    InfoList?: AcsEventInfo[];
  };
};

export type AcsEventCond = {
  searchID: string;
  searchResultPosition: number;
  maxResults: number;
  major: number;
  minor: number;
  startTime: string;
  endTime: string;
  picEnable: boolean;
};

export type AttendanceRow = {
  id: string;
  employeeNo: string;
  surname: string;
  firstName: string;
  department: string;
  arrivalTime: string | null;
  departureTime: string | null;
  picturePath: string | null;
  isLate: boolean;
};

export type AttendanceStats = {
  totalEmployees: number;
  arrived: number;
  late: number;
  absent: number;
};
