window.parseRawRhythm = (raw) => {
    // raw = "xx.x..xx..x..xx."
    // parsed = [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] 
    let rhythm_arr = new Array(loopLength).fill(0); // Example array with 16 elements

    for (let i=0; i < loopLength; i++) {
        if (raw[i] == "x") {
            rhythm_arr[i] = 1
        }
    }
    return rhythm_arr
}

window.PATTERNLIB = {
    
    "kick":{
        "boombap": [
            "x.......x.x.....",
            "x......xx.x.....",
            "x......xx.x...x.",
            "x..x...xx.x..x.."
        ],
        "westcoast": [
            "x.........x..x..",
            "x..x..x...x..x..",
            "x..x..x.x.....x.",
            "x..x..x.xx....xx"
        ],
        "trap": [
            "x.....x...x.....",
            "x..x......x..x..",
            "x..x..xx..x..x..",
            "xx.x..xx..x..xx."
        ],
        "neptunes": [
            "x.........x..x..",
            "x.....xx..x.....",
            "x.....xxxxx..x..",
            "x.x..x.x.x.x...."
        ],
    },
    
    
    
    "snare":{
        "boombap": [
            "....x.......x...",
            "....x.......x..x",
            "....x....x..x...",
            "....x....x..x..x"
        ],
        "westcoast": [
            "....x.......x...",
            "....x.......x...",
            "....x..x....x...",
            "....x..x....x.x."
        ],
        "trap": [
            "....x.......x...",
            "....x..x....x...",
            "....x..x.x..x..x",
            ".x..x..x.x..xx.x"
        ],
        "neptunes": [
            "....x.......x...",
            "....x.......x.x.",
            "....x.......x..x",
            "....x..x....x.x."            
        ],
    },
    
    
    
    "hihat":{
        "boombap": [
            "x...x...x...x...",
            "x.x...x...x...x.",
            "x.x.x.x.x.x.x.x.",
            "x.xxx.x.x.x.xxx."
        ],
        "westcoast": [
            "..x...x...x...x.",
            "..x...x.xx....x.",
            "x..x..x...xx....",
            "xxxx..xx..xx..x."
        ],
        "trap": [
            "x.x.x.x.x.xxxxxx",
            "xxxxx.x.x.xxx.xx",
            "xxxxx.xxxxxxx.xx",
            "xxxxxxxxxxxxxxxx"
        ],
        "neptunes": [
            "..xx..xx..xx..xx",
            "xxxxx.x.x.x.x.x.",
            "x.x.......x..xx.",
            "x.xxx.x.x.x.x.x."            
        ],
    },
    
    
    
    "brass":{
        "boombap": [
            "x.......x.......",
            "x.......x.......",
            "x.......x.......",
            "x.......x......."
        ],
        "westcoast": [
            "x.......x.......",
            "x.......x.......",
            "x.......x.......",
            "x.......x......."
        ],
        "trap": [
            "x.......x.......",
            "x.......x.......",
            "x.......x.......",
            "x.......x......."
        ],
        "neptunes": [
            "x.......x.......",
            "x.......x.......",
            "x.......x.......",
            "x.......x......."
        ],
    },
    
    
    
    "synth":{
        "boombap": [
            "x.......x.......",
            "x.......x.......",
            "x.......x.......",
            "x.......x......."
        ],
        "westcoast": [
            "x.......x.......",
            "x.......x.......",
            "x.......x.......",
            "x.......x......."
        ],
        "trap": [
            "x.......x.......",
            "x.......x.......",
            "x.......x.......",
            "x.......x......."
        ],
        "neptunes": [
            "x.......x.......",
            "x.......x.......",
            "x.......x.......",
            "x.......x......."
        ],
    },

}











