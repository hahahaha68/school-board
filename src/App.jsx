import './App.css'
import Teacher from "./Teacher"
import { useState, useEffect } from 'react'
import { supabase } from "./supabase"


function App() {
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

    setStatus({
      sports:data.sports,
      library:data.library,
      gym:data.gym
    })

  }

}


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


 
  const [messages,setMessages] = useState([])


  useEffect(()=>{

    loadMessages()

  },[])



  async function loadMessages(){

    const {data,error} = await supabase
      .from("messages")
      .select("*")
      .order("created_at",{ascending:false})


    if(error){
      console.log(error)
    }
    else{
      setMessages(data)
    }

  }



  useEffect(()=>{

    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event:"INSERT",
          schema:"public",
          table:"messages"
        },
        (payload)=>{

          setMessages(prev=>[
            ...prev,
            payload.new
          ])

        }
      )
      .subscribe()


    return ()=>{
      supabase.removeChannel(channel)
    }


  },[])
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

{
teacherMode ?

<Teacher />

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
              <b>체육</b>
              <p>{status.sports}</p>
            </div>


            <div className="statusBox">
              <b>도서관</b>
              <p>{status.library}</p>
            </div>


            <div className="statusBox">
              <b>헬스장</b>
              <p>{status.gym}</p>
            </div>


          </div>


        </div>




        <div className="infoArea">


          <div className="infoBox">

            <h3>날씨 안내</h3>

            <p>{weather.condition}</p>
            <p>{weather.temperature}</p>
            <p>미세먼지 {weather.dust}</p>

          </div>




          <div className="infoBox">

            <h3>오늘의 급식 안내</h3>


         {
  todayMeal ?

  todayMeal.menu.split("/").map((item,index)=>(

    <p key={index}>
      🍴 {item.trim()}
    </p>

  ))

  :

  <p>급식 없음</p>

}


          </div>
<div 
className="infoBox"
onClick={()=>setPasswordMode(true)}
>

<h3>선생님 화면</h3>

</div>
{
passwordMode &&

<div className="infoBox">

<h3>선생님 비밀번호</h3>

<input
type="password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
/>


<button
onClick={()=>{

if(password==="1234"){

  setTeacherMode(true)
  setPasswordMode(false)

}
else{

  alert("비밀번호가 틀렸습니다")

}

}}
>
확인
</button>

</div>

}

        </div>



      </div>
}

    </div>

  )

}


export default App