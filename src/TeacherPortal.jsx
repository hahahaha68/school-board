import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import Teacher from "./Teacher";

const SCHOOL_CODE = "YS2026";

function makeLoginEmail(schoolCode, loginId) {
  const cleanSchoolCode = schoolCode.trim().toLowerCase();
  const cleanLoginId = loginId.trim().toLowerCase();

  return `${cleanSchoolCode}.${cleanLoginId}@schoolboard.app`;
}

function TeacherPortal() {
  const [school, setSchool] = useState(null);
  const [session, setSession] = useState(null);
  const [teacherProfile, setTeacherProfile] = useState(null);

  const [selectedClass, setSelectedClassState] = useState(
    Number(localStorage.getItem("selectedClass")) || 1
  );
  const [selectedGrade, setSelectedGradeState] = useState(
  Number(localStorage.getItem("selectedGrade")) || 1
);

  const [authMode, setAuthMode] = useState("login");
  const [schoolCode, setSchoolCode] = useState(SCHOOL_CODE);
  const [approvalCode, setApprovalCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
function setSelectedGrade(grade) {
  const value = Number(grade);

  setSelectedGradeState(value);
  localStorage.setItem("selectedGrade", String(value));
}
  function setSelectedClass(classNumber) {
    const value = Number(classNumber);

    setSelectedClassState(value);
    localStorage.setItem("selectedClass", String(value));
  }

  const loadSchool = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      "get_public_school",
      {
        input_school_code: SCHOOL_CODE,
      }
    );

    if (error) {
      throw error;
    }

    const foundSchool = Array.isArray(data) ? data[0] : data;

    if (!foundSchool) {
      throw new Error("학교 정보를 찾을 수 없습니다.");
    }

    setSchool(foundSchool);
    return foundSchool;
  }, []);

  const loadTeacherProfile = useCallback(async (userId) => {
    if (!userId) {
      setTeacherProfile(null);
      return null;
    }

    const { data, error } = await supabase
      .from("teacher_profiles")
      .select(
        "user_id, school_id, login_id, display_name, is_active"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    setTeacherProfile(data ?? null);
    return data ?? null;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setLoading(true);

      try {
        await loadSchool();

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);

        if (currentSession?.user) {
          await loadTeacherProfile(currentSession.user.id);
        }
      } catch (error) {
        console.error("선생님 화면 초기화 오류:", error);

        if (mounted) {
          setErrorMessage(error.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);

        if (nextSession?.user) {
          window.setTimeout(() => {
            loadTeacherProfile(nextSession.user.id).catch(
              console.error
            );
          }, 0);
        } else {
          setTeacherProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadSchool, loadTeacherProfile]);

  function clearInputs() {
    setApprovalCode("");
    setDisplayName("");
    setLoginId("");
    setPassword("");
    setErrorMessage("");
  }

  function changeAuthMode(mode) {
    clearInputs();
    setAuthMode(mode);
    setSchoolCode(SCHOOL_CODE);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setErrorMessage("");

    const normalizedSchoolCode = schoolCode.trim().toUpperCase();
    const normalizedLoginId = loginId.trim().toLowerCase();

    if (
      !normalizedSchoolCode ||
      !normalizedLoginId ||
      !password
    ) {
      setErrorMessage(
        "학교 코드, 아이디, 비밀번호를 모두 입력하세요."
      );
      return;
    }

    setAuthLoading(true);

    try {
      const email = makeLoginEmail(
        normalizedSchoolCode,
        normalizedLoginId
      );

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        throw new Error(
          "학교 코드, 아이디 또는 비밀번호가 올바르지 않습니다."
        );
      }

      const profile = await loadTeacherProfile(data.user.id);

      if (!profile) {
        await supabase.auth.signOut();

        throw new Error(
          "교사 등록이 완료되지 않은 계정입니다. 같은 아이디와 비밀번호로 ‘교사 계정 만들기’를 진행하세요."
        );
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error("사용이 중지된 교사 계정입니다.");
      }

      clearInputs();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setErrorMessage("");

    const normalizedSchoolCode = schoolCode.trim().toUpperCase();
    const normalizedLoginId = loginId.trim().toLowerCase();

    if (
      !normalizedSchoolCode ||
      !approvalCode.trim() ||
      !displayName.trim() ||
      !normalizedLoginId ||
      !password
    ) {
      setErrorMessage("모든 항목을 입력하세요.");
      return;
    }

    if (!/^[a-z0-9_-]{4,30}$/.test(normalizedLoginId)) {
      setErrorMessage(
        "아이디는 영문 소문자, 숫자, 밑줄, 하이픈으로 4~30자만 가능합니다."
      );
      return;
    }

    if (displayName.trim().length < 2) {
      setErrorMessage("선생님 이름을 두 글자 이상 입력하세요.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setAuthLoading(true);

    try {
      const email = makeLoginEmail(
        normalizedSchoolCode,
        normalizedLoginId
      );

      let user = null;

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (signUpError) {
        throw signUpError;
      }

      user = signUpData.user;

      if (!signUpData.session) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) {
          throw new Error(
            "이미 사용 중인 아이디이거나 비밀번호가 올바르지 않습니다."
          );
        }

        user = signInData.user;
      }

      if (!user) {
        throw new Error("사용자 계정을 만들지 못했습니다.");
      }

      const { error: profileError } = await supabase.rpc(
        "register_teacher_profile",
        {
          input_school_code: normalizedSchoolCode,
          input_approval_code: approvalCode.trim(),
          input_login_id: normalizedLoginId,
          input_display_name: displayName.trim(),
        }
      );

      if (profileError) {
        await supabase.auth.signOut();

        if (
          profileError.message.includes(
            "학교 코드 또는 승인 코드"
          )
        ) {
          throw new Error(
            "학교 코드 또는 학교 관계자 승인 코드가 올바르지 않습니다."
          );
        }

        throw profileError;
      }

      const profile = await loadTeacherProfile(user.id);

      if (!profile) {
        throw new Error("교사 프로필을 불러오지 못했습니다.");
      }

      clearInputs();
    } catch (error) {
      console.error("교사 가입 오류:", error);
      setErrorMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setTeacherProfile(null);
    setAuthMode("login");
    clearInputs();
  }

  function goToBoard() {
    window.location.assign("/");
  }

  if (loading) {
    return (
      <div className="portalLoading">
        선생님 화면을 준비하는 중입니다.
      </div>
    );
  }

  if (
    session?.user &&
    teacherProfile?.is_active &&
    school
  ) {
    return (
      <Teacher
  setTeacherMode={(enabled) => {
    if (!enabled) {
      goToBoard();
    }
  }}
  selectedGrade={selectedGrade}
  setSelectedGrade={setSelectedGrade}
  selectedClass={selectedClass}
  setSelectedClass={setSelectedClass}
  school={school}
  session={session}
  teacherProfile={teacherProfile}
  onLogout={handleLogout}
/>
    );
  }

  return (
    <div className="teacherPortal">
      <button
        type="button"
        className="portalBackButton"
        onClick={goToBoard}
      >
        ← 전자칠판으로 돌아가기
      </button>

      <section className="portalAuthCard">
        <div className="portalBrand">
          <span>{school?.school_name ?? "영석고등학교"}</span>
          <h1>선생님 화면</h1>
          <p>
            학교에서 승인받은 교사만 사용할 수 있습니다.
          </p>
        </div>

        <div className="authTabs">
          <button
            type="button"
            className={authMode === "login" ? "active" : ""}
            onClick={() => changeAuthMode("login")}
          >
            로그인
          </button>

          <button
            type="button"
            className={
              authMode === "register" ? "active" : ""
            }
            onClick={() => changeAuthMode("register")}
          >
            교사 계정 만들기
          </button>
        </div>

        <form
          className="authForm"
          onSubmit={
            authMode === "login"
              ? handleLogin
              : handleRegister
          }
        >
          <label>
            학교 코드
            <input
              value={schoolCode}
              onChange={(event) =>
                setSchoolCode(
                  event.target.value.toUpperCase()
                )
              }
              placeholder="학교 코드"
              autoComplete="organization"
            />
          </label>

          {authMode === "register" && (
            <>
              <label>
                학교 관계자 승인 코드
                <input
                  type="password"
                  value={approvalCode}
                  onChange={(event) =>
                    setApprovalCode(event.target.value)
                  }
                  placeholder="학교 관계자 승인 코드"
                  autoComplete="off"
                />
              </label>

              <label>
                선생님 이름
                <input
                  value={displayName}
                  onChange={(event) =>
                    setDisplayName(event.target.value)
                  }
                  placeholder="예: 김선생"
                  autoComplete="name"
                />
              </label>
            </>
          )}

          <label>
            개인 아이디
            <input
              value={loginId}
              onChange={(event) =>
                setLoginId(event.target.value.toLowerCase())
              }
              placeholder="영문 소문자와 숫자 4자 이상"
              autoComplete="username"
            />
          </label>

          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="8자 이상"
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
            />
          </label>

          {errorMessage && (
            <p className="authError">{errorMessage}</p>
          )}

          <button
            type="submit"
            className="primaryButton"
            disabled={authLoading}
          >
            {authLoading
              ? "처리 중..."
              : authMode === "login"
                ? "로그인"
                : "계정 만들기"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default TeacherPortal;