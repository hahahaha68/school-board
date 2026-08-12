import './App.css'
import Teacher from "./Teacher"
import { useState, useEffect } from 'react'
import { supabase } from "./supabase"
import logo from "./logo.png"

function App() {
  const [selectedClass, setSelectedClass] = useState(
  Number(localStorage.getItem("selectedClass")) || 1
)
const [settingMode, setSettingMode] = useState(false)
const [passwordMode,setPasswordMode] = useState(false)
const [password,setPassword] = useState("")
const [teacherMode,setTeacherMode] = useState(false)

 const [status,setStatus] = useState({
  sports:"",
  library:"",
  gym:""
})


async function loadStatus(){

  const {data,error} = await supabase
    .from("status")
    .select("*")
    .eq("id",1)
    .single()


  if(error){
    console.log(error)
  }
  else{
console.log(data)


    setStatus({
      sports:data.sports,
      library:data.library,
      gym:data.gym
    })

  }

}



useEffect(()=>{

  loadStatus()

},[])

  const [weather,setWeather] = useState({
  condition:"",
  temperature:"",
  dust:""
})
useEffect(()=>{

  loadWeather()

},[])


async function loadWeather(){

  const response = await fetch(
    "https://api.open-meteo.com/v1/forecast?latitude=37.74&longitude=127.04&current_weather=true"
  )

  const data = await response.json()

  const code = data.current_weather.weathercode

  let condition = "맑음"


  if(code === 0){
    condition = "☀️ 맑음"
  }
  else if(
    code === 1 ||
    code === 2 ||
    code === 3
  ){
    condition = "☁️ 구름"
  }
  else if(
    code >= 51 &&
    code <= 67
  ){
    condition = "🌧️ 비"
  }
  else if(
    code >= 71 &&
    code <= 77
  ){
    condition = "❄️ 눈"
  }
  else if(
    code >= 80 &&
    code <= 82
  ){
    condition = "🌧️ 소나기"
  }
  else{
    condition = "날씨 확인 필요"
  }


  setWeather({

    temperature: data.current_weather.temperature + "℃",

    condition: condition,

    dust:"정보 없음"

  })

}

  const [mealData,setMealData] = useState([])
useEffect(()=>{

  loadMeal()

},[])
async function loadMeal(){

  const {data,error}=await supabase
    .from("meal")
    .select("*")


  if(error){
    console.log(error)
  }
  else{
    setMealData(data)
  }

}
  const todayMeal = mealData.find(
    meal => meal.date === new Date().toISOString().slice(0,10)
  )


 
const [messages, setMessages] = useState([])
const [assignments, setAssignments] = useState([])


async function loadMessages(){

  const {data,error} = await supabase
    .from("messages")
    .select("*")
    .eq("class_id", selectedClass)
    .order("created_at",{ascending:false})

  if(error){
    console.log(error)
  }
  else{
    const now = new Date()

    const filtered = data.filter((msg) => {
      const created = new Date(msg.created_at)
      const diff = now - created

      return diff < 24 * 60 * 60 * 1000
    })

    setMessages(filtered)
  }
}


async function loadAssignments(){

  const {data,error} = await supabase
    .from("assignments")
    .select("*")
    .eq("class_id", selectedClass)
    .order("date",{ascending:true})

  if(error){
    console.log(error)
  }
  else{
    setAssignments(data)
  }
}


function getDDay(date){

  const today = new Date()
  const target = new Date(date)

  today.setHours(0,0,0,0)
  target.setHours(0,0,0,0)

  const diff = Math.ceil(
    (target - today) / (1000 * 60 * 60 * 24)
  )

  if(diff > 0) return `D-${diff}`
  if(diff === 0) return "D-DAY"
  return "종료"
}


useEffect(() => {

  setMessages([])
  setAssignments([])

  loadMessages()
  loadAssignments()

}, [selectedClass])



useEffect(() => {

  const channel = supabase
    .channel(`messages-${selectedClass}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      (payload) => {

        if (Number(payload.new.class_id) === Number(selectedClass)) {
          setMessages(prev => [
            payload.new,
            ...prev
          ])
        }

      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }

}, [selectedClass])
useEffect(()=>{

  const channel = supabase
    .channel("status")
    .on(
      "postgres_changes",
      {
        event:"UPDATE",
        schema:"public",
        table:"status"
      },
      (payload)=>{

        setStatus({
          sports: payload.new.sports,
          library: payload.new.library,
          gym: payload.new.gym
        })

      }
    )
    .subscribe()


  return ()=>{

    supabase.removeChannel(channel)

  }

},[])


  return(
    
    

    <div className="screen">
      {settingMode && (
  <div className="settingOverlay">

    <div className="settingBox">

  <h2>설정</h2>

  <p>사용할 반을 선택하세요.</p>

  <select
    value={selectedClass}
    onChange={(e) => {
      const value = Number(e.target.value)

      setSelectedClass(value)
      localStorage.setItem("selectedClass", value)
    }}
  >
    {[1,2,3,4,5,6,7,8,9,10].map((classNumber) => (
      <option key={classNumber} value={classNumber}>
        {classNumber}반
      </option>
    ))}
  </select>


  {/* 선생님 화면 */}

  <button
    className="teacherSettingButton"
    onClick={() => {
      setSettingMode(false)
      setPasswordMode(true)
    }}
  >
    선생님 화면
  </button>


  <button
    className="settingCloseButton"
    onClick={() => setSettingMode(false)}
  >
    닫기
  </button>

</div>

  </div>
)}
<div className="header">

  
    <div className="logoBox">
  <img src={logo} alt="학교 로고" />
</div>

  <div className="schoolName">
     <div className="schoolKorean">영석 고등학교</div>
    
  <div className="schoolEnglishName"> youngseok high school, Affiliated with with Dongguk university college of Education</div>
  </div>

  <button
  className="settingButton"
  onClick={() => setSettingMode(true)}
>
  설정
</button>
</div>
{
teacherMode ?

<Teacher
  setTeacherMode={setTeacherMode}
  selectedClass={selectedClass}
  setSelectedClass={setSelectedClass}
/>
:

<div className="yellowArea">

        <div className="topArea">


          <div className="messageBox">

            <h2>선생님 메시지</h2>


            {
              messages.map((msg,index)=>(

                <div className="messageText" key={index}>

                  <b>{msg.sender}</b>

                  <br/>

                  {msg.text}

                </div>

              ))
            }


          </div>



          <div className="sideMenu">


            <div className="statusBox">
             <h3>날씨 안내</h3>

  <div className="weatherRow">
    <p>{weather.condition}</p>
    <p>{weather.temperature}</p>
  </div>

  <p>미세먼지 {weather.dust}</p>
</div>

          


          <div className="facilityBox">

  <div
    className={
      status.library === "이용 가능"
        ? "libraryPart available"
        : "libraryPart unavailable"
    }
  >
    <b>도서관</b>
    <p>{status.library}</p>
  </div>

  <div
    className={
      status.gym === "이용 가능"
        ? "gymPart available"
        : "gymPart unavailable"
    }
  >
    <b className="gymTitle">IT 헬스장</b>
    <p>{status.gym}</p>
    
  </div>



</div>
          </div>


        </div>




       


         <div className="infoBox assignmentBox">

  <h3>수행평가 공지</h3>

  {assignments.length > 0 ? (

    assignments.map((assignment) => (

      <div className="assignmentItem" key={assignment.id}>
  <b>{assignment.subject}: {assignment.title} {getDDay(assignment.date)}</b>
</div>
    ))

  ) : (

    <p>예정된 수행평가가 없습니다.</p>

  )}





          <div className="infoBox mealBox">

            <h3>오늘의 급식 안내</h3>


         {
  todayMeal ?
<div className="mealList">
  {todayMeal.menu.split("/").map((item,index)=>(

    <p key={index}>
      ● {item.trim()}
    </p>

  ))}
</div>
  :

  <p>급식 없음</p>

}


          </div>

{
passwordMode &&

<div className="passwordOverlay">

  <div className="passwordBox">

    <h2>선생님 화면</h2>

    <p>비밀번호를 입력하세요</p>

    <input
      type="password"
      value={password}
      onChange={(e)=>setPassword(e.target.value)}
      autoFocus
    />

    <button
      onClick={()=>{

        if(password === "1234"){

          setTeacherMode(true)
          setPasswordMode(false)
          setPassword("")

        }
        else{

          alert("비밀번호가 틀렸습니다")

        }

      }}
    >
      확인
    </button>

  </div>

</div>
}


        </div>



      </div>
}

    </div>

  )

}


export default App