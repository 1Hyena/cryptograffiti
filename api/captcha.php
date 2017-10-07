<?php
require('./auth.php');

$img = "";
if (isset($_GET['img'])) $img = $_GET['img'];

$token = hash("sha256", $img.CAPTCHA_SALT, false);

// Adapted for The Art of Web: www.the-art-of-web.com
// Please acknowledge use of this code by including this header.

// initialise image with dimensions of 160 x 45 pixels
$image = @imagecreatetruecolor(160, 45) or die("Cannot Initialize new GD image stream");

// set background and allocate drawing colours
$background = imagecolorallocate($image, 0xff, 0xff, 0xff);
imagefill($image, 0, 0, $background);
$linecolor1 = imagecolorallocate($image, 0x0,  0x0,  0x0);
$linecolor2 = imagecolorallocate($image, 0xff, 0xff, 0xff);
$textcolor1 = imagecolorallocate($image, 0x0,  0x0,  0x0);
$textcolor2 = imagecolorallocate($image, 0xff, 0xff, 0xff);

// draw random lines on canvas
for ($i=0; $i < 3; $i++) {
    imagesetthickness($image, rand(1,2));
    imageline($image, rand(0,160), rand(0,45), rand(0,160), rand(0,45), $linecolor1);
}

// using a mixture of TTF fonts
$fonts = array();
$fonts[] = "captcha.ttf";

$pos = 0;
for ($x = 10; $pos < 5; $x += 30, $pos++) {
    $textcolor = (rand() % 2) ? $textcolor1 : $textcolor2;
    $num = substr($token, $pos, 1);
    $dir = rand(-30,30);
    $y = rand(20, 42);
    $f = array_rand($fonts);

    for ($k=0; $k<7; $k++) {
        $tc = $textcolor;
        if ($k % 2 === 0) $tc = ($textcolor === $textcolor1 ? $textcolor2 : $textcolor1);
        imagettftext($image, 20, $dir+rand(-10, 10), $x+rand(1,3), $y+rand(1,3), $tc, $fonts[$f], $num);
    }
}

for ($i=0; $i < 3; $i++) {
    imagesetthickness($image, rand(1,2));
    imageline($image, rand(0,160), rand(0,45), rand(0,160), rand(0,45), $linecolor2);
}

// display image and clean up
header('Content-type: image/png');
imagepng($image);
imagedestroy($image);
?>
