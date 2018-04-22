--Version 1.1
--Author: icedude
--Created: 29.11.2014
--Modifyed: 21.12.2014

--Notes: 
--Speed improvements can be made with lua 5.3 using bitwise operators.
--Need for bignum library is overhead.
--Use better Sha256 library, like  [lcrypt]...makes use of C functions and might be faster.
--lcrypt has better and faster bignum library i think but lacks power to function on bignum if i remember
--need to add failsafes when getting text from addresses

--USE--
--Bitcoin.isAddress(Base58String) returns true/false
--Bitcoin.stringToAddress(20charString) returns base58string
--Bitcoin.addressToString(Base58String) returns string
--Bitcoin.isBase58(Base58String) returns true/false
--Bitcoin.genAddressesFromText(string,endWithNewline) returns address{}
--Bitcoin.getTextFromAddresses(address{}) returns string


local char0=''
for i =1, 21 do char0=char0.."\0" end
local char1=''
for i =1, 21 do char1=char1.."1" end

local function charToHex(c)  return string.format("%02x", string.byte(c)) end --unused at the moment
local function str2hex (s)  return string.gsub(s, ".", charToHex) end --unused at the moment

local hexToCharTable= {['0']=0,['1']=1,['2']=2,['3']=3,['4']=4,['5']=5,['6']=6,['7']=7,['8']=8,['9']=9,['a']=10,['b']=11,['c']=12,['d']=13,['e']=14,['f']=15,['A']=10,['B']=11,['C']=12,['D']=13,['E']=14,['F']=15}
local function hexStringToCharString(hexString)
  local enc = {} 
  for h1, h2 in string.gmatch(hexString, "(%x)(%x)") do 
    table.insert(enc, string.char(hexToCharTable[h1]*16+hexToCharTable[h2]))
  end 
  return table.concat(enc)
end


local function testAddress(addressBase58)
  if (addressBase58:len()<26 or addressBase58:len()>35) then return false end
  if (addressBase58:sub(1,1)~='1') then return false end
  
  local leadone=0; --"1" is ascii 49
  for i=1,addressBase58:len() do
    if (addressBase58:byte(i)~=49) then break end
    leadone=i
  end   
  
  local addressCharString=char0:sub(0,leadone)..Base58.base58ToCharString(addressBase58)
  local payload=addressCharString:sub(1,21)
  local checksum=addressCharString:sub(22,25)
  local sha256result=Hash.hash256(hexStringToCharString(Hash.hash256(payload)))
  local value=hexStringToCharString(sha256result):sub(1,4)
  if (value==checksum) then return true else return false end
end



local function stringToAddress(payload)
  if (payload:len()<20) then payload=payload..char0:sub(0,20-payload:len()) end
  if (payload:len()>20) then payload=payload:sub(1,20) end
  --print (payload:len())
  local text="\0"..payload
  local sha256result=Hash.hash256(hexStringToCharString(Hash.hash256(text)))
  local checksum=hexStringToCharString(sha256result):sub(1,4)
  text=text..checksum
  --need to add 0 byte to 1 manually because bigint dont include zero bytes
  local leadzero=0;
  for i=1,text:len() do
    if (text:byte(i)~=0) then break end
    leadzero=i
  end 
  --print('lead= '..leadzero)
  return char1:sub(0,leadzero)..Base58.stringToBase58(text)
end


local function addressToString(address)
  if (address:len()<26 or address:len()>35) then return false end
  if (address:sub(1,1)~='1') then return false end
  
  local leadone=0; --"1" is ascii 49
  for i=1,address:len() do
    if (address:byte(i)~=49) then break end
    leadone=i
  end   
  
  local addressCharString=char0:sub(0,leadone)..Base58.base58ToCharString(address)
  return addressCharString:sub(2,21)
end

local function isBase58(str)
  return Base58.isBase58(str)
end

local function genAddressesFromText (text, endWithNewline) 
    if(endWithNewline == nil) then endWithNewline=true end
    if (endWithNewline==true and text:len() > 20 and text:find("\n")==nil) then text = text.."\n"end
    local nrOfAddressesNeeded = math.floor((text:len()-1) / 20)+1
    local addressesAsTextInArray = {}
    for i = 0, (nrOfAddressesNeeded-1) do
      table.insert(addressesAsTextInArray, stringToAddress(text:sub(i * 20+1, i*20+20+1)))
    end
    return addressesAsTextInArray;
end

local function getTextFromAddresses (addressArray) 
  local text=''
  for k, v in ipairs(addressArray) do
    text=text..addressToString(v)
  end
  return text
end

Bitcoin=  {
  isAddress= function(...) return testAddress(...) end,
  stringToAddress= function(...) return stringToAddress(...) end,
  addressToString= function(...) return addressToString(...) end,
  isBase58= function(...) return isBase58(...) end,
  genAddressesFromText= function(...) return genAddressesFromText(...) end,
  getTextFromAddresses= function(...) return getTextFromAddresses(...) end,
}
