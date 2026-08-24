import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./supabase";
import logo from "./logo.png";

const SCHOOL_CODE = "YS2026";
const GRADES = [1, 2, 3];
const CLASS_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function App() {
  const [selectedGrade, setSelectedGrade] = useState(
    Number(localStorage.getItem("selectedGrade")) || 1
  );

  const [selectedClass, setSelectedClass] = useState(
    Number(localStorage.getItem("selectedClass")) || 1
  );

  const [settingMode, setSettingMode] = useState(false);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [status, setStatus] = useState({
    library: "",
    gym: "",
  });

  const [weather, setWeather] = useState({
    condition: "날씨 확인 중",
    temperature: "",
    dust: "정보 없음",
  });

  const [mealData, setMealData] = useState([]);
  const [messages, setMessages] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const today = getLocalDateString();

  const todayMeal = useMemo(
    () => mealData.find((meal) => meal.date === today),
    [mealData, today]
  );

  function changeSelectedGrade(grade) {
    const value = Number(grade);

    setSelectedGrade(value);
    localStorage.setItem("selectedGrade", String(value));
  }

  function changeSelectedClass(classNumber) {
    const value = Number(classNumber);

    setSelectedClass(value);
    localStorage.setItem("selectedClass", String(value));
  }

  const loadPublicSchool = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      "get_public_school",
      {
        input_school_code: SCHOOL_CODE,
      }
    );

    if (error) throw error;

    const foundSchool = Array.isArray(data) ? data[0] : data;

    if (!foundSchool) {
      throw new Error("학교 정보를 찾을 수 없습니다.");
    }

    setSchool(foundSchool);
    return foundSchool;
  }, []);

  const loadStatus = useCallback(async (schoolId) => {
    if (!schoolId) return;

    const { data, error } = await supabase
      .from("status")
      .select("id, library, gym")
      .eq("school_id", schoolId)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("시설 상태 조회 오류:", error);
      return;
    }

    if (data) {
      setStatus({
        library: data.library ?? "",
        gym: data.gym ?? "",
      });
    }
  }, []);

  const loadMeal = useCallback(async (schoolId) => {
    if (!schoolId) return;

    const { data, error } = await supabase
      .from("meal")
      .select("id, date, menu")
      .eq("school_id", schoolId)
      .eq("date", getLocalDateString());

    if (error) {
      console.error("급식 조회 오류:", error);
      return;
    }

    setMealData(data ?? []);
  }, []);

  const loadMessages = useCallback(
    async (schoolId) => {
      if (!schoolId) return;

      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, sender, text, created_at, grade, class_id"
        )
        .eq("school_id", schoolId)
        .eq("grade", selectedGrade)
        .eq("class_id", selectedClass)
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("메시지 조회 오류:", error);
        return;
      }

      setMessages(data ?? []);
    },
    [selectedGrade, selectedClass]
  );

  const loadAssignments = useCallback(
    async (schoolId) => {
      if (!schoolId) return;

      const { data, error } = await supabase
        .from("assignments")
        .select(
          "id, grade, class_id, subject, title, date"
        )
        .eq("school_id", schoolId)
        .eq("grade", selectedGrade)
        .eq("class_id", selectedClass)
        .gte("date", getLocalDateString())
        .order("date", { ascending: true });

      if (error) {
        console.error("수행평가 조회 오류:", error);
        return;
      }

      setAssignments(data ?? []);
    },
    [selectedGrade, selectedClass]
  );

  const loadWeather = useCallback(async () => {
    try {
      const response = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=37.74&longitude=127.04&current_weather=true"
      );

      if (!response.ok) {
        throw new Error("날씨 서버 응답 오류");
      }

      const data = await response.json();
      const currentWeather = data.current_weather;
      const code = currentWeather?.weathercode;

      let condition = "날씨 확인 필요";

      if (code === 0) {
        condition = "☀️ 맑음";
      } else if ([1, 2, 3].includes(code)) {
        condition = "☁️ 구름";
      } else if (code >= 51 && code <= 67) {
        condition = "🌧️ 비";
      } else if (code >= 71 && code <= 77) {
        condition = "❄️ 눈";
      } else if (code >= 80 && code <= 82) {
        condition = "🌧️ 소나기";
      }

      setWeather({
        condition,
        temperature:
          currentWeather?.temperature === undefined
            ? ""
            : `${currentWeather.temperature}℃`,
        dust: "정보 없음",
      });
    } catch (error) {
      console.error("날씨 조회 오류:", error);

      setWeather({
        condition: "날씨 정보를 불러오지 못했습니다",
        temperature: "",
        dust: "정보 없음",
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initializeBoard() {
      setLoading(true);
      setLoadError("");

      try {
        const foundSchool = await loadPublicSchool();

        await Promise.all([
          loadStatus(foundSchool.id),
          loadMeal(foundSchool.id),
          loadMessages(foundSchool.id),
          loadAssignments(foundSchool.id),
          loadWeather(),
        ]);
      } catch (error) {
        console.error("전자칠판 초기화 오류:", error);

        if (mounted) {
          setLoadError(error.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeBoard();

    return () => {
      mounted = false;
    };
  }, [
    loadAssignments,
    loadMeal,
    loadMessages,
    loadPublicSchool,
    loadStatus,
    loadWeather,
  ]);

  useEffect(() => {
    if (!school?.id) return;

    setMessages([]);
    setAssignments([]);

    loadMessages(school.id);
    loadAssignments(school.id);
  }, [
    school?.id,
    selectedGrade,
    selectedClass,
    loadAssignments,
    loadMessages,
  ]);

  useEffect(() => {
    if (!school?.id) return undefined;

    const channel = supabase
      .channel(
        `board-${school.id}-${selectedGrade}-${selectedClass}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `school_id=eq.${school.id}`,
        },
        () => loadMessages(school.id)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assignments",
          filter: `school_id=eq.${school.id}`,
        },
        () => loadAssignments(school.id)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal",
          filter: `school_id=eq.${school.id}`,
        },
        () => loadMeal(school.id)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "status",
          filter: `school_id=eq.${school.id}`,
        },
        () => loadStatus(school.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    school?.id,
    selectedGrade,
    selectedClass,
    loadAssignments,
    loadMeal,
    loadMessages,
    loadStatus,
  ]);

  function getDDay(dateString) {
    const currentDate = new Date(
      `${getLocalDateString()}T00:00:00`
    );

    const targetDate = new Date(
      `${dateString}T00:00:00`
    );

    const difference = Math.round(
      (targetDate - currentDate) /
        (1000 * 60 * 60 * 24)
    );

    if (difference > 0) return `D-${difference}`;
    if (difference === 0) return "D-DAY";

    return "종료";
  }

  function openTeacherPage() {
    window.location.assign("/teacher");
  }

  const selectedClassName =
    `${selectedGrade}학년 ${selectedClass}반`;

  return (
    <div className="screen">
      <header className="header">
        <div className="logoBox">
          <img src={logo} alt="학교 로고" />
        </div>

        <div className="schoolName">
          <div className="schoolKorean">
            {school?.school_name ?? "영석고등학교"}
          </div>

          <div className="schoolEnglishName">
            Youngseok High School
          </div>
        </div>

        <button
          type="button"
          className="settingButton"
          onClick={() => setSettingMode(true)}
        >
          설정
        </button>
      </header>

      <main className="boardArea">
        {loading ? (
          <div className="boardLoading">
            학교 정보를 불러오는 중입니다.
          </div>
        ) : loadError ? (
          <div className="boardLoading">
            데이터를 불러오지 못했습니다: {loadError}
          </div>
        ) : (
          <>
            <section className="messageBox boardCard">
              <h2>
                선생님 메시지 · {selectedClassName}
              </h2>

              <div className="messageList">
                {messages.length > 0 ? (
                  messages.map((message) => (
                    <article
                      className="messageText"
                      key={message.id}
                    >
                      <b>{message.sender || "선생님"}</b>
                      <p>{message.text}</p>
                    </article>
                  ))
                ) : (
                  <p className="emptyText">
                    최근 메시지가 없습니다.
                  </p>
                )}
              </div>
            </section>

            <aside className="sideMenu">
              <section className="statusBox boardCard">
                <h3>날씨 안내</h3>

                <div className="weatherRow">
                  <p>{weather.condition}</p>
                  <strong>{weather.temperature}</strong>
                </div>

                <small>미세먼지 {weather.dust}</small>
              </section>

              <section className="facilityBox boardCard">
                <div
                  className={`libraryPart ${
                    status.library === "이용 가능"
                      ? "available"
                      : "unavailable"
                  }`}
                >
                  <b>도서관</b>
                  <p>{status.library || "확인 중"}</p>
                </div>

                <div
                  className={`gymPart ${
                    status.gym === "이용 가능"
                      ? "available"
                      : "unavailable"
                  }`}
                >
                  <b>IT 헬스장</b>
                  <p>{status.gym || "확인 중"}</p>
                </div>
              </section>
            </aside>

            <section className="infoBox assignmentBox boardCard">
              <h3>수행평가 공지 · {selectedClassName}</h3>

              <div className="assignmentContent">
                {assignments.length > 0 ? (
                  assignments.map((assignment) => (
                    <div
                      className="assignmentItem"
                      key={assignment.id}
                    >
                      <b>
                        {assignment.subject} ·{" "}
                        {assignment.title}
                      </b>

                      <strong>
                        {getDDay(assignment.date)}
                      </strong>
                    </div>
                  ))
                ) : (
                  <p className="emptyText">
                    예정된 수행평가가 없습니다.
                  </p>
                )}
              </div>
            </section>

            <section className="infoBox mealBox boardCard">
              <h3>오늘의 급식 안내</h3>

              {todayMeal?.menu ? (
                <div className="mealList">
                  {todayMeal.menu
                    .split(/[/,]/)
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item, index) => (
                      <span key={`${item}-${index}`}>
                        ● {item}
                      </span>
                    ))}
                </div>
              ) : (
                <p className="emptyText">
                  등록된 급식이 없습니다.
                </p>
              )}
            </section>
          </>
        )}
      </main>

      {settingMode && (
        <div className="modalOverlay">
          <div className="settingBox modalBox">
            <h2>전자칠판 설정</h2>
            <p>표시할 학년과 반을 선택하세요.</p>

            <select
              value={selectedGrade}
              onChange={(event) =>
                changeSelectedGrade(event.target.value)
              }
            >
              {GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}학년
                </option>
              ))}
            </select>

            <select
              value={selectedClass}
              onChange={(event) =>
                changeSelectedClass(event.target.value)
              }
            >
              {CLASS_NUMBERS.map((classNumber) => (
                <option
                  key={classNumber}
                  value={classNumber}
                >
                  {classNumber}반
                </option>
              ))}
            </select>

            <button
              type="button"
              className="primaryButton"
              onClick={openTeacherPage}
            >
              선생님 화면 열기
            </button>

            <button
              type="button"
              className="secondaryButton"
              onClick={() => setSettingMode(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;