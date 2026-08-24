import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
const GRADES = [1, 2, 3];
const CLASS_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const EMPTY_STATUS = {
  sports: "이용 불가",
  library: "이용 불가",
  gym: "이용 불가",
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  const original = String(value ?? "").trim();

  if (!original) return null;

  if (/^\d{5}$/.test(original)) {
    const excelDate = new Date(
      Math.round((Number(original) - 25569) * 86400 * 1000)
    );

    if (!Number.isNaN(excelDate.getTime())) {
      return getLocalDateString(excelDate);
    }
  }

  const matched = original.match(
    /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/
  );

  if (!matched) return null;

  const year = matched[1];
  const month = String(Number(matched[2])).padStart(2, "0");
  const day = String(Number(matched[3])).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;
  const checkedDate = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(checkedDate.getTime())) return null;

  return dateString;
}

function detectDelimiter(text) {
  const firstLine = text
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);

  if (!firstLine) return ",";

  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;

  if (tabCount > commaCount && tabCount >= semicolonCount) {
    return "\t";
  }

  if (semicolonCount > commaCount) {
    return ";";
  }

  return ",";
}

function parseCsvRows(text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(cleanText);
  const rows = [];

  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const character = cleanText[index];
    const nextCharacter = cleanText[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (character === delimiter && !insideQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (
      (character === "\n" || character === "\r") &&
      !insideQuotes
    ) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(field.trim());

      if (row.some((item) => item.length > 0)) {
        rows.push(row);
      }

      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  row.push(field.trim());

  if (row.some((item) => item.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function convertRowsToMeals(rows) {
  if (rows.length === 0) {
    throw new Error("CSV 파일에 내용이 없습니다.");
  }

  const normalizedHeader = rows[0].map((value) =>
    value.replace(/\s/g, "").toLowerCase()
  );

  const dateHeaders = [
    "date",
    "날짜",
    "일자",
    "급식일자",
    "급식일",
  ];

  const menuHeaders = [
    "menu",
    "메뉴",
    "급식",
    "급식메뉴",
    "중식",
    "식단",
    "요리명",
  ];

  let dateIndex = normalizedHeader.findIndex((header) =>
    dateHeaders.includes(header)
  );

  let menuIndex = normalizedHeader.findIndex((header) =>
    menuHeaders.includes(header)
  );

  let dataRows = rows;

  if (dateIndex === -1) {
    dateIndex = 0;
  } else {
    dataRows = rows.slice(1);
  }

  if (menuIndex === -1) {
    menuIndex = dateIndex === 0 ? 1 : 0;
  }

  const mealMap = new Map();

  dataRows.forEach((row) => {
    const date = normalizeDate(row[dateIndex]);

    if (!date) return;

    let menu = String(row[menuIndex] ?? "").trim();

    if (!menu && row.length > 1) {
      menu = row
        .filter((_, index) => index !== dateIndex)
        .map((item) => item.trim())
        .filter(Boolean)
        .join(" / ");
    }

    menu = menu
      .replace(/\r?\n/g, " / ")
      .replace(/\s*\/\s*/g, " / ")
      .trim();

    if (!menu) return;

    mealMap.set(date, {
      date,
      menu,
    });
  });

  const meals = Array.from(mealMap.values());

  if (meals.length === 0) {
    throw new Error(
      "날짜와 메뉴를 찾지 못했습니다. 첫 열은 날짜, 다음 열은 메뉴 형식으로 만들어주세요."
    );
  }

  return meals;
}

async function readCsvFile(file) {
  const buffer = await file.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buffer);

  if (text.includes("�")) {
    try {
      text = new TextDecoder("euc-kr").decode(buffer);
    } catch {
      // UTF-8 결과를 그대로 사용합니다.
    }
  }

  return text;
}

function Teacher({
  setTeacherMode,
  selectedGrade,
  setSelectedGrade,
  selectedClass,
  setSelectedClass,
  school,
  session,
  teacherProfile,
  onLogout,
}) {
  const fileInputRef = useRef(null);

  const [favoriteClasses, setFavoriteClasses] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("favoriteClasses")) ?? []
      );
    } catch {
      return [];
    }
  });

  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [statusId, setStatusId] = useState(null);
  const [status, setStatus] = useState(EMPTY_STATUS);

  const [assignmentSubject, setAssignmentSubject] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDate, setAssignmentDate] = useState("");
  const [assignments, setAssignments] = useState([]);

  const [working, setWorking] = useState(false);
  const [csvMessage, setCsvMessage] = useState("");
  const [notice, setNotice] = useState("");

  const schoolId = teacherProfile.school_id;
  const userId = session.user.id;
const selectedClassName =
  `${selectedGrade}학년 ${selectedClass}반`;
  const showNotice = (message) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 3000);
  };

  const loadMessages = useCallback(async () => {
    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("messages")
      .select("id, text, sender, created_at, class_id, teacher_id")
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
  }, [schoolId, selectedGrade, selectedClass]);

  const loadAssignments = useCallback(async () => {
    const { data, error } = await supabase
      .from("assignments")
      .select("id, class_id, subject, title, date, teacher_id")
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
 }, [schoolId, selectedGrade, selectedClass]);

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase
      .from("status")
      .select("id, sports, library, gym")
      .eq("school_id", schoolId)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("시설 상태 조회 오류:", error);
      return;
    }

    if (!data) {
      setStatusId(null);
      setStatus(EMPTY_STATUS);
      return;
    }

    setStatusId(data.id);
    setStatus({
      sports: data.sports || "이용 불가",
      library: data.library || "이용 불가",
      gym: data.gym || "이용 불가",
    });
  }, [schoolId]);

  useEffect(() => {
    loadMessages();
    loadAssignments();
    loadStatus();
  }, [loadAssignments, loadMessages, loadStatus]);

  useEffect(() => {
    const channel = supabase
      .channel(
  `teacher-${schoolId,
selectedGrade,
selectedClass}-${selectedGrade}-${selectedClass}`
)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `school_id=eq.${schoolId}`,
        },
        loadMessages
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assignments",
          filter: `school_id=eq.${schoolId}`,
        },
        loadAssignments
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "status",
          filter: `school_id=eq.${schoolId}`,
        },
        loadStatus
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    loadAssignments,
    loadMessages,
    loadStatus,
    schoolId,
    selectedClass,
  ]);

  function toggleFavorite(classNumber) {
    const updated = favoriteClasses.includes(classNumber)
      ? favoriteClasses.filter((number) => number !== classNumber)
      : [...favoriteClasses, classNumber];

    setFavoriteClasses(updated);
    localStorage.setItem(
      "favoriteClasses",
      JSON.stringify(updated)
    );
  }

  async function sendMessage() {
    const text = messageInput.trim();

    if (!text || working) return;

    setWorking(true);

    const { error } = await supabase.from("messages").insert({
school_id: schoolId,
teacher_id: userId,
sender: teacherProfile.display_name,
text,
grade: selectedGrade,
class_id: selectedClass,
    });

    setWorking(false);

    if (error) {
      console.error("메시지 전송 오류:", error);
      showNotice(`메시지 전송 실패: ${error.message}`);
      return;
    }

    setMessageInput("");
    showNotice(`${selectedClassName}에 메시지를 보냈습니다.`);
    loadMessages();
  }

  async function deleteMessage(id) {
    const shouldDelete = window.confirm(
      "이 메시지를 삭제할까요?"
    );

    if (!shouldDelete) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) {
      console.error("메시지 삭제 오류:", error);
      showNotice(`삭제 실패: ${error.message}`);
      return;
    }

    showNotice("메시지를 삭제했습니다.");
    loadMessages();
  }

  async function saveAssignment() {
    if (
      !assignmentSubject.trim() ||
      !assignmentTitle.trim() ||
      !assignmentDate
    ) {
      showNotice("과목, 수행평가 이름, 날짜를 모두 입력하세요.");
      return;
    }

    setWorking(true);

    const { error } = await supabase.from("assignments").insert({
      school_id: schoolId,
teacher_id: userId,
grade: selectedGrade,
class_id: selectedClass,
subject: assignmentSubject.trim(),
    });

    setWorking(false);

    if (error) {
      console.error("수행평가 등록 오류:", error);
      showNotice(`수행평가 등록 실패: ${error.message}`);
      return;
    }

    setAssignmentSubject("");
    setAssignmentTitle("");
    setAssignmentDate("");
    showNotice(`${selectedClassName} 수행평가를 등록했습니다.`);
    loadAssignments();
  }

  async function deleteAssignment(id) {
    const shouldDelete = window.confirm(
      "이 수행평가를 삭제할까요?"
    );

    if (!shouldDelete) return;

    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) {
      console.error("수행평가 삭제 오류:", error);
      showNotice(`삭제 실패: ${error.message}`);
      return;
    }

    showNotice("수행평가를 삭제했습니다.");
    loadAssignments();
  }

  function toggleStatus(name) {
    setStatus((current) => ({
      ...current,
      [name]:
        current[name] === "이용 가능"
          ? "이용 불가"
          : "이용 가능",
    }));
  }

  async function saveStatus() {
    setWorking(true);

    const values = {
      school_id: schoolId,
      teacher_id: userId,
      sports: status.sports,
      library: status.library,
      gym: status.gym,
    };

    let error;

    if (statusId) {
      const result = await supabase
        .from("status")
        .update(values)
        .eq("id", statusId)
        .eq("school_id", schoolId);

      error = result.error;
    } else {
      const result = await supabase
        .from("status")
        .insert(values)
        .select("id")
        .single();

      error = result.error;

      if (result.data?.id) {
        setStatusId(result.data.id);
      }
    }

    setWorking(false);

    if (error) {
      console.error("시설 상태 저장 오류:", error);
      showNotice(`시설 상태 저장 실패: ${error.message}`);
      return;
    }

    showNotice("시설 상태를 저장했습니다.");
  }

  async function uploadMealCsv(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setWorking(true);
    setCsvMessage("CSV 파일을 읽는 중입니다.");

    try {
      const text = await readCsvFile(file);
      const parsedMeals = convertRowsToMeals(parseCsvRows(text));
      const dates = parsedMeals.map((meal) => meal.date);

      const { error: deleteError } = await supabase
        .from("meal")
        .delete()
        .eq("school_id", schoolId)
        .in("date", dates);

      if (deleteError) {
        throw deleteError;
      }

      const rowsToInsert = parsedMeals.map((meal) => ({
        school_id: schoolId,
        teacher_id: userId,
        date: meal.date,
        menu: meal.menu,
      }));

      const { error: insertError } = await supabase
        .from("meal")
        .insert(rowsToInsert);

      if (insertError) {
        throw insertError;
      }

      setCsvMessage(
        `${parsedMeals.length}일의 급식 정보를 등록했습니다.`
      );
      showNotice("급식 CSV 등록이 완료됐습니다.");
    } catch (error) {
      console.error("CSV 등록 오류:", error);
      setCsvMessage(`등록 실패: ${error.message}`);
    } finally {
      setWorking(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const orderedClasses = [
    ...favoriteClasses,
    ...CLASS_NUMBERS.filter(
      (classNumber) =>
        !favoriteClasses.includes(classNumber)
    ),
  ];

  return (
    <div className="teacherPage">
      <header className="teacherHeader">
        <div>
          <p className="teacherSchoolName">
            {school.school_name}
          </p>
          <h1>{teacherProfile.display_name} 선생님</h1>
        </div>

        <div className="teacherHeaderActions">
          <button
            type="button"
            className="headerSecondaryButton"
            onClick={() => setTeacherMode(false)}
          >
            전자칠판
          </button>

          <button
            type="button"
            className="headerSecondaryButton"
            onClick={onLogout}
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="teacherDashboard">
        <section className="teacherCard classCard">
          <div className="cardTitleRow">
            <div>
              <span className="cardNumber">01</span>
              <h2>반 선택</h2>
            </div>

            <button
              type="button"
              className="favoriteButton"
              title="즐겨찾기"
              onClick={() => toggleFavorite(selectedClass)}
            >
              {favoriteClasses.includes(selectedClass)
                ? "★"
                : "☆"}
            </button>
          </div>
<select
  className="largeSelect gradeSelect"
  value={selectedGrade}
  onChange={(event) =>
    setSelectedGrade(Number(event.target.value))
  }
>
  {GRADES.map((grade) => (
    <option key={grade} value={grade}>
      {grade}학년
    </option>
  ))}
</select>
          <select
            className="largeSelect"
            value={selectedClass}
            onChange={(event) =>
              setSelectedClass(Number(event.target.value))
            }
          >
            {orderedClasses.map((classNumber) => (
              <option key={classNumber} value={classNumber}>
                {favoriteClasses.includes(classNumber)
                  ? "★ "
                  : ""}
                {classNumber}반
              </option>
            ))}
          </select>
        </section>

        <section className="teacherCard messageComposerCard">
          <div className="cardTitleRow">
            <div>
              <span className="cardNumber">02</span>
              <h2>메시지 보내기</h2>
            </div>
            <strong>{selectedClassName}</strong>
          </div>

          <div className="messageComposer">
            <textarea
              value={messageInput}
              maxLength={500}
              onChange={(event) =>
                setMessageInput(event.target.value)
              }
              placeholder="학생들에게 보낼 메시지를 입력하세요."
            />

            <button
              type="button"
              className="sendMessageButton"
              disabled={working || !messageInput.trim()}
              onClick={sendMessage}
            >
              메시지
              <br />
              보내기
            </button>
          </div>
        </section>

        <section className="teacherCard messageDeleteCard">
          <div className="cardTitleRow">
            <div>
              <span className="cardNumber">03</span>
              <h2>메시지 삭제</h2>
            </div>
          </div>

          <div className="teacherMessageList">
            {messages.length > 0 ? (
              messages.map((message) => (
                <article
                  className="teacherMessage"
                  key={message.id}
                >
                  <div>
                    <b>{message.sender}</b>
                    <p>{message.text}</p>
                  </div>

                  <button
                    type="button"
                    className="roundDeleteButton"
                    title="메시지 삭제"
                    onClick={() =>
                      deleteMessage(message.id)
                    }
                  >
                    ×
                  </button>
                </article>
              ))
            ) : (
              <p className="teacherEmptyText">
                최근 메시지가 없습니다.
              </p>
            )}
          </div>
        </section>

        <section className="teacherCard assignmentRegisterCard">
          <div className="cardTitleRow">
            <div>
              <span className="cardNumber">04</span>
              <h2>수행평가 등록</h2>
            </div>
            <strong>{selectedClass}반</strong>
          </div>

          <div className="assignmentForm">
            <input
              value={assignmentSubject}
              onChange={(event) =>
                setAssignmentSubject(event.target.value)
              }
              placeholder="과목"
            />

            <input
              value={assignmentTitle}
              onChange={(event) =>
                setAssignmentTitle(event.target.value)
              }
              placeholder="수행평가 이름"
            />

            <input
              type="date"
              value={assignmentDate}
              min={getLocalDateString()}
              onChange={(event) =>
                setAssignmentDate(event.target.value)
              }
            />

            <button
              type="button"
              className="teacherPrimaryButton"
              disabled={working}
              onClick={saveAssignment}
            >
              등록
            </button>
          </div>

          <div className="assignmentManageList">
            {assignments.map((assignment) => (
              <article
                className="assignmentManageItem"
                key={assignment.id}
              >
                <div>
                  <b>
                    {assignment.subject} · {assignment.title}
                  </b>
                  <span>{assignment.date}</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    deleteAssignment(assignment.id)
                  }
                >
                  삭제
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="teacherCard facilityControlCard">
          <div className="cardTitleRow">
            <div>
              <span className="cardNumber">05</span>
              <h2>시설물 관련 온·오프</h2>
            </div>
          </div>

          <div className="facilityControls">
            <button
              type="button"
              className={
                status.library === "이용 가능"
                  ? "facilityToggle active"
                  : "facilityToggle"
              }
              onClick={() => toggleStatus("library")}
            >
              <span>도서관</span>
              <i />
              <b>{status.library}</b>
            </button>

            <button
              type="button"
              className={
                status.gym === "이용 가능"
                  ? "facilityToggle active"
                  : "facilityToggle"
              }
              onClick={() => toggleStatus("gym")}
            >
              <span>IT 헬스장</span>
              <i />
              <b>{status.gym}</b>
            </button>

            
          </div>

          <button
            type="button"
            className="teacherPrimaryButton statusSaveButton"
            disabled={working}
            onClick={saveStatus}
          >
            시설 상태 저장
          </button>
        </section>

        <section className="teacherCard csvCard">
          <div className="cardTitleRow">
            <div>
              <span className="cardNumber">06</span>
              <h2>급식 CSV 등록</h2>
            </div>
          </div>

          <p className="csvHelp">
            첫 번째 행에 <b>date, menu</b> 또는
            <b> 날짜, 메뉴</b>가 있는 CSV 파일을 선택하세요.
          </p>

          <input
            ref={fileInputRef}
            className="csvFileInput"
            type="file"
            accept=".csv,text/csv"
            disabled={working}
            onChange={uploadMealCsv}
          />

          {csvMessage && (
            <p className="csvResult">{csvMessage}</p>
          )}
        </section>
      </main>

      {notice && <div className="teacherToast">{notice}</div>}
    </div>
  );
}

export default Teacher;