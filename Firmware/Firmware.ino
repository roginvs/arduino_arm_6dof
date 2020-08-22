#include "./VarSpeedServo/VarSpeedServo.cpp"

#define SERVO_COUNT 6

VarSpeedServo myservo[SERVO_COUNT]; // create servo object to control a servo
// twelve servo objects can be created on most boards

int pos = 0; // variable to store the servo position

void setup()
{
    Serial.begin(9600);
    Serial.print("Starting\n");

    for (int i = 0; i < SERVO_COUNT; i++)
    {
        myservo[i].attach(8 + i);
    };

    for (int i = 0; i < SERVO_COUNT; i++)
    {
        myservo[i].write(90, 100);
    };
}

void loop()
{
    Serial.print("A1\n");

    myservo[0].write(90 - 60, 100);
    Serial.print("A2\n");

    myservo[0].wait();
    Serial.print("A3\n");

    Serial.print("A4\n");

    myservo[0].write(90 + 60, 100);
    Serial.print("A5\n");

    myservo[0].wait();
    Serial.print("A6\n");
}
