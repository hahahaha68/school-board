import { useState, useEffect } from "react"
import { supabase } from "./supabase"


function Teacher({setTeacherMode}){

  const [input,setInput] = useState("")
  const [messages,setMessages] = useState([])


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
          text:input
        }
      ])


    if(error){
      console.log(error)
    }


    setInput("")

  }




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

},[])
  return(

    <div className="teacherPage">


      <h2>선생님 화면</h2>



      <h3>메시지 보내기</h3>


      <textarea

        value={input}

        onChange={(e)=>setInput(e.target.value)}

        placeholder="학생들에게 보낼 메시지"

      />


      <button onClick={sendMessage}>
        메시지 보내기
      </button>
<h3>최근 메시지</h3>

{
  messages.map((msg)=>(
    <div key={msg.id}>

      {msg.text}

      <button
        onClick={()=>deleteMessage(msg.id)}
      >
        🗑
      </button>

    </div>
  ))
}
<button
  onClick={()=>setTeacherMode(false)}
>
  전자칠판으로 돌아가기
</button>


      <h3>시설 상태 변경</h3>


      <p>체육</p>

      <select

        value={status.sports}

        onChange={(e)=>
          setStatus({
            ...status,
            sports:e.target.value
          })
        }

      >

        <option>사용 가능</option>
        <option>사용 중</option>
        <option>사용 불가</option>

      </select>



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
        <option>이용 중</option>
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

        <option>사용 가능</option>
        <option>사용 중</option>
        <option>사용 불가</option>

      </select>



      <button onClick={saveStatus}>
        상태 저장
      </button>


    </div>

  )

}


export default Teacher