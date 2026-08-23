import { useState, useEffect } from "react"
import { supabase } from "./supabase"
function Teacher({
  setTeacherMode,
  selectedClass,
  setSelectedClass
}) {

  const [favoriteClasses, setFavoriteClasses] = useState(
    JSON.parse(localStorage.getItem("favoriteClasses")) || []
  )

  const [input,setInput] = useState("")
  const [messages,setMessages] = useState([])

  const [status,setStatus] = useState({
    sports:"",
    library:"",
    gym:""
  })

  const [assignmentSubject, setAssignmentSubject] = useState("")
  const [assignmentTitle, setAssignmentTitle] = useState("")
  const [assignmentDate, setAssignmentDate] = useState("")

  function toggleFavorite(classNumber){

    let updated

    if(favoriteClasses.includes(classNumber)){
      updated = favoriteClasses.filter(
        (num) => num !== classNumber
      )
    }
    else{
      updated = [...favoriteClasses, classNumber]
    }

    setFavoriteClasses(updated)

    localStorage.setItem(
      "favoriteClasses",
      JSON.stringify(updated)
    )
  }
  async function loadMessages(){

  const {data,error} = await supabase
    .from("messages")
    .select("*")
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

async function saveAssignment(){

  if(!assignmentSubject || !assignmentTitle || !assignmentDate){
    alert("모든 항목을 입력하세요")
    return
  }

  const {error} = await supabase
    .from("assignments")
    .insert([
      {
        class_id: selectedClass,
        subject: assignmentSubject,
        title: assignmentTitle,
        date: assignmentDate
      }
    ])

  if(error){
    console.log(error)
    alert("수행평가 등록에 실패했습니다")
    return
  }

  alert(`${selectedClass}반 수행평가가 등록되었습니다`)

  setAssignmentSubject("")
  setAssignmentTitle("")
  setAssignmentDate("")
}
  async function deleteMessage(id){

    const {error} = await supabase
      .from("messages")
      .delete()
      .eq("id", id)


    if(error){
      console.log(error)
    }
    else{
      loadMessages()
    }

  }


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




  async function sendMessage(){

    if(!input) return


    const {error} = await supabase
      .from("messages")
      .insert([
        {
  sender:"선생님",
  text:input,
  class_id:selectedClass
}
      ])


    if(error){
      console.log(error)
    }


    setInput("")

  }


useEffect(() => {
  const channel = supabase
    .channel("teacher-messages")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages"
      },
      () => {
        loadMessages()
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])

 async function saveStatus(){

  const result = await supabase
    .from("status")
    .update({
      sports: status.sports,
      library: status.library,
      gym: status.gym
    })
    .eq("id",1)
    .select()


  console.log(result)
alert(JSON.stringify(result))
}


useEffect(()=>{

  loadMessages()
  loadStatus()

  const interval = setInterval(() => {
    loadMessages()
    loadStatus()
  }, 60 * 1000)

  return () => clearInterval(interval)

},[])
  return(

    <div className="teacherPage">


      <h2>선생님 화면</h2>



     <h3>메시지 보내기</h3>

<h4>반 선택</h4>

<div className="classSelectRow">

  <select
    value={selectedClass}
    onChange={(e) =>
      setSelectedClass(Number(e.target.value))
    }
  >
    {[
  ...favoriteClasses,
  ...[1,2,3,4,5,6,7,8,9,10]
    .filter((classNumber) => !favoriteClasses.includes(classNumber))
].map((classNumber) => (
  <option key={classNumber} value={classNumber}>
    {favoriteClasses.includes(classNumber) ? "⭐ " : ""}
    {classNumber}반
  </option>
))}
     
  </select>

  <button
    className="favoriteButton"
    onClick={() => toggleFavorite(selectedClass)}
  >
    {favoriteClasses.includes(selectedClass) ? "⭐" : "☆"}
  </button>

</div>

<p>현재 선택된 반: {selectedClass}반</p>

<select
  value={selectedClass}
  onChange={(e) => setSelectedClass(Number(e.target.value))}
>
  {[1,2,3,4,5,6,7,8,9,10].map((classNumber) => (
    <option key={classNumber} value={classNumber}>
      {classNumber}반
    </option>
  ))}
</select>

<textarea
  value={input}
  onChange={(e)=>setInput(e.target.value)}
  placeholder="학생들에게 보낼 메시지"
/> 


     

      <button onClick={sendMessage}>
        메시지 보내기
      </button>
<h3>최근 메시지</h3>

<div className="teacherMessageList">
  {messages.map((msg) => (
    <div className="teacherMessage" key={msg.id}>

      <div className="teacherBubble">
        <span>{msg.text}</span>

        <button
          className="deleteMessageButton"
          onClick={() => deleteMessage(msg.id)}
        >
          x
        </button>
      </div>

    </div>
  ))}
</div>
<button
  onClick={()=>setTeacherMode(false)}
>
  전자칠판으로 돌아가기
</button>


      <h3>수행평가 등록</h3>

<p>현재 선택된 반: {selectedClass}반</p>

<input
  type="text"
  value={assignmentSubject}
  onChange={(e) => setAssignmentSubject(e.target.value)}
  placeholder="과목"
/>

<input
  type="text"
  value={assignmentTitle}
  onChange={(e) => setAssignmentTitle(e.target.value)}
  placeholder="수행평가 이름"
/>

<input
  type="date"
  value={assignmentDate}
  onChange={(e) => setAssignmentDate(e.target.value)}
/>
<button onClick={saveAssignment}>
  수행평가 등록
</button>
      
      <h3>시설 상태 변경</h3>


      
      <p>도서관</p>

      <select

        value={status.library}

        onChange={(e)=>
          setStatus({
            ...status,
            library:e.target.value
          })
        }

      >

        <option>이용 가능</option>
     
        <option>이용 불가</option>

      </select>



      <p>헬스장</p>

      <select

        value={status.gym}

        onChange={(e)=>
          setStatus({
            ...status,
            gym:e.target.value
          })
        }

      >

        <option>이용 가능</option>

        <option>이용 불가</option>

      </select>



      <button onClick={saveStatus}>
        상태 저장
      </button>


    </div>

  )

}


export default Teacher