var mapImages={};

function login(nickname,password){
    if(nickname===undefined){nickname=$('#login_nickname').val();}
    if(password===undefined){password=$('#login_password').val();}
    socket.emit('login',nickname,password,function(res){
        if(res=="Success."){
            showDiv($('#rooms')[0]);
            return;
        }
        showDiv($('#loginDiv')[0]);
        $('#login_info').removeClass('successMessage').addClass('errorMessage').html(res);
    });
}

function register(){
    if($("#reg_nickname").val()==""){
        $('#reg_info').removeClass('successMessage').addClass('errorMessage').html("Nickname cann't be empty.");
        return;
    }
    if($("#reg_password").val()==""){
        $('#reg_info').removeClass('successMessage').addClass('errorMessage').html("Password cann't be empty.");
        return;
    }
    if($("#reg_password").val()!=$("#password_verify").val()){
        $('#reg_info').removeClass('successMessage').addClass('errorMessage').html("Passwords do not match.");
        return;
    }
    var nickname=$("#reg_nickname").val();
    var password=$("#reg_password").val()

	var xhttp = new XMLHttpRequest();
    var url = "registration";
    var params= "nickname="+nickname+"&password="+password;
    xhttp.open("POST", url, true);

    xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    xhttp.onreadystatechange = function() {
        if(xhttp.readyState == 4 && xhttp.status == 200) {
            if(xhttp.responseText!="Success."){
                $('#reg_info').removeClass('successMessage').addClass('errorMessage').html(xhttp.responseText);
                return;
            }
            $('#reg_info').removeClass('errorMessage').addClass('successMessage').html("Registration successful.<br>Signing in.");
            setTimeout(function(){
                login(nickname,password);
            },3000);
        }
    }
    xhttp.send(params);
}

function showDiv(div){
    $('.showAndCenter').removeClass('showAndCenter').addClass('hiddenDiv');
    $(div).removeClass('hiddenDiv').addClass('showAndCenter');

    if(div==$('#rooms')[0]){
        refreshRooms();
    }
    verticalCenterDiv(div);
}

function verticalCenterDiv(div){
    $(div).css({
        top:(document.body.offsetHeight-div.offsetHeight)/2+"px"
    });
}

function refreshRooms(){
    socket.emit('getRoomsList',function(rooms){
        if(typeof rooms=="string"){
            $('#rooms_info').removeClass('successMessage').addClass('errorMessage').html(rooms);
            return;
        }
        var firstRow=$('#roomsTable')[0].children[0];
        $('#roomsTable').html("").append(firstRow);
        for(var i=0;i<rooms.length;i++){
            $('#roomsTable').append($("<tr><td>"+rooms[i].name+"</td>"+
                "<td><a onclick='userProfil("+rooms[i].oponent+");'>"+rooms[i].oponent+"</a></td>"+
                "<td>"+rooms[i].map_name+"<br><img class='map_image' src='"+rooms[i].map_image+"'></td>"+
                "<td><button type='button' onclick='play("+rooms[i].id+");'>Play</button></td></tr>"));
        }
        if(!rooms.length){
            $('#rooms_info').html("There is no room.");
        }
    });

    socket.emit("getMapsList",function(maps){
        if(typeof maps=="string"){
            $('#create_room_info').removeClass('successMessage').addClass('errorMessage').html(maps);
            return;
        }
        $('#map_id').html("");
        for(var i=0;i<maps.length;i++){
            $('#map_id').append($("<option value="+maps[i].MapID+">"+maps[i].Name+"</option>"));
            mapImages[maps[i].MapID]=maps[i].Image;
        }
    });
}

function changeMapImage(){
    $("#map_image").attr("src",mapImages[$("#map_name").val()]);
}

function createRoom(){
    if($('#game_name').val()==""){
        $('#create_room_info').removeClass('successMessage').addClass('errorMessage').html("Game name cann't be empty.");
        return;
    }
    socket.emit('createRoom',$('#game_name').val(),$("#map_id").val(),function(res){
        showDiv($("#waitingDiv")[0]);
    });
}

function resize(){
    $('body').css({
        'height':window.innerHeight+"px"
    });
    verticalCenterDiv($('.showAndCenter')[0]);
}

var socket=io(":9000");
socket.on("disconnect",function(){
    showDiv($("#loginDiv")[0]);
    $('#login_info').removeClass('successMessage').addClass('errorMessage').html("Connection to the server was lost.");
});
resize();
$(window).on("resize",resize);