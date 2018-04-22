--Version 1.1
--Author: icedude
--Created: 29.11.2014
--Created: 29.11.2014

--Notes: 
--Needs better way to handle format to format maybe.
--Need better names for functions i think;
--Replace some Bignum.new() with existing ones
--Make local referances of bignums


local alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
local asc256 = {} --ascii char value is converted to 58base value
for i=0,255 do
  local alphaIndex = alphabet:find(string.char(i),1,true)
  if (alphaIndex==nil) then alphaIndex=-1 end
  asc256[i]=alphaIndex
  --print (asc256[i])
end

local b58=BigNum.new(58)
local b256=BigNum.new(256)
local reminder = BigNum.new(0)
local result = BigNum.new(0)
local result2 = BigNum.new(0)


local function bignumToCharString(bignum)
  local bNum=BigNum.new(bignum)
  local enc = {}
  while(tostring(bNum) ~= '0') do
    BigNum.div(bNum,b256,result,reminder)
    BigNum.change(bNum,result)
    table.insert(enc, string.char(tonumber(tostring(reminder))))
  end
  return table.concat(enc):reverse()
end

local function stringToBignum(str)
  local bNum = BigNum.new()
  for c in str:gmatch('.') do
    BigNum.mul(bNum,b256,result)
    BigNum.change(bNum,result)
    BigNum.add(bNum,BigNum.new(c:byte(1)),result)
    BigNum.change(bNum,result)
  end
  return bNum 
end

local function isBase58(str)
  for c in str:gmatch('.') do
    if (asc256[c]==-1) then return false end
  end
  return true
end

local function base58ToBignum(str)
  local bNum = BigNum.new()
  local i = 0
  for c in str:reverse():gmatch('.') do
    --BigNum.mul(BigNum.new(alphabet:find(c)-1) , BigNum.pow(b58,BigNum.new( i )),result)
    BigNum.mul(BigNum.new(asc256[string.byte(c)]-1) , BigNum.pow(b58,BigNum.new( i )),result)
    BigNum.add(bNum,result,result2)
    BigNum.change(bNum,result2)
    i = i + 1
  end
  return bNum
end

local function bignumToBase58(bignum)
  local bNum=BigNum.new(bignum)
  local enc = {}
  while(tostring(bNum) ~= '0') do
    BigNum.div(bNum,b58,result,reminder)
    local char =tonumber(tostring(reminder))+1
    table.insert(enc, alphabet:sub(char, char))
    BigNum.change(bNum,result)
  end
  return table.concat(enc):reverse()
end

local function base58ToCharString(str)
  return bignumToCharString(base58ToBignum(str))
end

local function stringToBase58(str)
  return bignumToBase58(stringToBignum(str))
end



Base58 = {
  --base58ToBignum= function(...) return base58ToBignum(...) end,
  base58ToCharString= function(...) return base58ToCharString(...) end,
  --bignumToBase58= function(...) return bignumToBase58(...) end,
  stringToBase58= function(...) return stringToBase58(...) end,
  isBase58= function(...) return isBase58(...) end,
}
